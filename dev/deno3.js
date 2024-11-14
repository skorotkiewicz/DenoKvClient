import { z } from "zod";
import { openKv } from "@deno/kv";

class SchemaBuilder {
  constructor() {
    this.models = new Map();
  }

  model(config) {
    for (const [modelName, modelConfig] of Object.entries(config)) {
      this.models.set(modelName, {
        schema: modelConfig.schema,
        relations: modelConfig.relations || {},
      });
    }
    return this;
  }

  getSchema(name) {
    return this.models.get(name)?.schema;
  }

  getRelations(name) {
    return this.models.get(name)?.relations || {};
  }

  getPrimaryKey(modelName) {
    const schema = this.getSchema(modelName);
    if (!schema?.shape) return null;

    for (const [key, field] of Object.entries(schema.shape)) {
      if (field.description === "primary") {
        return key;
      }
    }
    return null;
  }
}

export class DenoKvClient {
  constructor(schema) {
    this.kv = null;
    this.schema = schema;

    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop];
        }
        const namespace = target.namespace(prop);
        target[prop] = namespace;
        return namespace;
      },
    });
  }

  async init(url, accessToken) {
    this.kv = await openKv(url, { accessToken });
  }

  async close() {
    return this.kv.close();
  }

  namespace(collectionName) {
    const kv = this.kv;
    const schema = this.schema;
    const modelSchema = schema.getSchema(collectionName);
    const self = this; // Store reference to the instance

    if (!modelSchema) {
      throw new Error(`Schema for collection "${collectionName}" not found`);
    }

    return {
      async create({ data, select = {}, include = {} }) {
        try {
          const validated = modelSchema.parse(data);
          const id = validated.id || crypto.randomUUID();
          validated.id = id;
          validated.createdAt = validated.createdAt || new Date();

          const relatedData = {};
          const relations = schema.getRelations(collectionName);

          for (const [relationName, relationConfig] of Object.entries(
            relations
          )) {
            if (data[relationName] && Array.isArray(relationConfig)) {
              const [targetModel, targetSchema, localKey, foreignKey] =
                relationConfig;
              if (Array.isArray(data[relationName])) {
                relatedData[relationName] = await Promise.all(
                  data[relationName].map((item) =>
                    self[targetModel].create({
                      data: { ...item, [foreignKey]: id },
                    })
                  )
                );
              }
            }
          }

          const key = [collectionName, id];
          await kv.set(key, validated);

          return this._processResult(
            { ...validated, ...relatedData },
            { select, include },
            collectionName
          );
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new Error(
              `Validation error in ${collectionName}: ${error.message}`
            );
          }
          throw error;
        }
      },

      async findUnique({ where, select = {}, include = {} }) {
        const key = DenoKvClient.getKey(collectionName, where);
        const result = await kv.get(key);

        // console.log(collectionName);
        // console.log(where);

        if (!result) {
          return null;
        }

        return this._processResult(
          result.value,
          { select, include },
          collectionName
        );
      },

      async findMany({
        where = {},
        select = {},
        include = {},
        take,
        skip = 0,
        orderBy,
        cursor,
      }) {
        const prefix = [collectionName];
        const entries = kv.list({ prefix, cursor });
        const results = [];
        let count = 0;
        let lastCursor;

        for await (const entry of entries) {
          lastCursor = entry.key;
          if (count++ < skip) continue;
          if (take && results.length >= take) break;

          const item = entry.value;
          if (DenoKvClient.matchesWhere(item, where)) {
            const processed = await this._processResult(
              item,
              { select, include },
              collectionName
            );
            results.push(processed);
          }
        }

        if (orderBy) {
          const [field, order] = Object.entries(orderBy)[0];
          results.sort((a, b) => {
            const aVal = a[field];
            const bVal = b[field];
            return order === "asc"
              ? aVal > bVal
                ? 1
                : -1
              : aVal < bVal
              ? 1
              : -1;
          });
        }

        return {
          data: results,
          cursor: lastCursor,
          hasMore: results.length === take,
        };
      },

      async update({ where, data, select = {}, include = {} }) {
        const key = DenoKvClient.getKey(collectionName, where);
        const existingData = await this.findUnique({ where });

        if (!existingData) {
          return null;
        }

        try {
          const updatedData = modelSchema.parse({
            ...existingData,
            ...data,
            updatedAt: new Date(),
          });

          const relatedUpdates = {};
          const relations = schema.getRelations(collectionName);

          for (const [relationName, relationConfig] of Object.entries(
            relations
          )) {
            if (data[relationName]) {
              const [targetModel, targetSchema, localKey, foreignKey] =
                relationConfig;
              if (Array.isArray(data[relationName])) {
                relatedUpdates[relationName] = await Promise.all(
                  data[relationName].map((item) =>
                    self[targetModel].upsert({
                      where: { id: item.id },
                      create: { ...item, [foreignKey]: existingData.id },
                      update: item,
                    })
                  )
                );
              }
            }
          }

          await kv.set(key, updatedData);
          return this._processResult(
            { ...updatedData, ...relatedUpdates },
            { select, include },
            collectionName
          );
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new Error(`Validation error in update: ${error.message}`);
          }
          throw error;
        }
      },

      async delete({ where, select = {} }) {
        const key = DenoKvClient.getKey(collectionName, where);
        const existingData = await this.findUnique({ where });

        if (!existingData) {
          return null;
        }

        const relations = schema.getRelations(collectionName);

        for (const [relationName, relationConfig] of Object.entries(
          relations
        )) {
          if (Array.isArray(relationConfig)) {
            const [targetModel, targetSchema, localKey, foreignKey] =
              relationConfig;
            await self[targetModel].deleteMany({
              where: { [foreignKey]: existingData.id },
            });
          }
        }

        await kv.delete(key);
        return DenoKvClient.applySelect(existingData, select);
      },

      async deleteMany({ where = {} }) {
        const prefix = [collectionName];
        const entries = kv.list({ prefix });
        let count = 0;

        for await (const entry of entries) {
          const item = entry.value;
          if (DenoKvClient.matchesWhere(item, where)) {
            await kv.delete(entry.key);
            count++;
          }
        }

        return { count };
      },

      async upsert({ where, create, update, select = {}, include = {} }) {
        const existing = await this.findUnique({ where });

        if (existing) {
          return this.update({
            where,
            data: update,
            select,
            include,
          });
        } else {
          return this.create({
            data: create,
            select,
            include,
          });
        }
      },

      async count({ where = {} }) {
        const prefix = [collectionName];
        const entries = kv.list({ prefix });
        let count = 0;

        for await (const entry of entries) {
          if (DenoKvClient.matchesWhere(entry.value, where)) {
            count++;
          }
        }

        return count;
      },

      async _processResult(data, { select = {}, include = {} }, modelName) {
        if (!data) return null;

        let result = { ...data };

        if (Object.keys(include).length > 0) {
          const relations = schema.getRelations(modelName);

          for (const [relationName, included] of Object.entries(include)) {
            if (!included || !relations[relationName]) continue;

            const [targetModel, targetSchema, localKey, foreignKey] =
              relations[relationName];

            if (self[targetModel]) {
              if (Array.isArray(targetSchema)) {
                const relatedItems = await self[targetModel].findMany({
                  where: { [foreignKey]: data[localKey] },
                });
                result[relationName] = relatedItems.data;
              } else {
                const relatedItem = await self[targetModel].findUnique({
                  where: { [foreignKey]: data[localKey] },
                });
                result[relationName] = relatedItem;
              }
            }
          }
        }

        if (Object.keys(select).length > 0) {
          result = DenoKvClient.applySelect(result, select);
        }

        return result;
      },
    };
  }

  static getKey(collectionName, where) {
    const parts = [collectionName];
    for (const [key, value] of Object.entries(where)) {
      parts.push(value);
    }
    return parts;
  }

  static applySelect(data, select) {
    if (!data) return null;
    if (Object.keys(select).length === 0) return data;

    const projection = {};
    for (const [field, included] of Object.entries(select)) {
      if (included && field in data) {
        projection[field] = data[field];
      }
    }
    return projection;
  }

  static matchesWhere(item, where) {
    return Object.entries(where).every(([key, value]) => {
      if (typeof value === "object" && value !== null) {
        return Object.entries(value).every(([op, opValue]) => {
          switch (op) {
            case "equals":
              return item[key] === opValue;
            case "not":
              return item[key] !== opValue;
            case "in":
              return opValue.includes(item[key]);
            case "notIn":
              return !opValue.includes(item[key]);
            case "lt":
              return item[key] < opValue;
            case "lte":
              return item[key] <= opValue;
            case "gt":
              return item[key] > opValue;
            case "gte":
              return item[key] >= opValue;
            case "contains":
              return item[key]?.includes(opValue);
            case "startsWith":
              return item[key]?.startsWith(opValue);
            case "endsWith":
              return item[key]?.endsWith(opValue);
            default:
              return false;
          }
        });
      }
      return item[key] === value;
    });
  }
}

export const createSchema = () => new SchemaBuilder();
