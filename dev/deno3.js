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
}

export class DenoKvClient {
  constructor(schema) {
    this.kv = null;
    this.schema = schema;
    this.initialized = false;
    this.initPromise = null;
    this.namespaces = new Map();

    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop];
        }

        if (!target.initialized && !target.initPromise) {
          throw new Error(
            "Client must be initialized before use. Call init() first."
          );
        }

        let namespace = target.namespaces.get(prop);
        if (!namespace) {
          namespace = target.namespace(prop);
          target.namespaces.set(prop, namespace);
        }
        return namespace;
      },
    });
  }

  async init(url, accessToken) {
    if (this.initialized) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        this.kv = await openKv(url, { accessToken });
        this.initialized = true;
      } catch (error) {
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  async close() {
    if (this.kv) {
      await this.kv.close();
      this.initialized = false;
      this.initPromise = null;
    }
  }

  namespace(collectionName) {
    const modelSchema = this.schema.getSchema(collectionName);

    if (!modelSchema) {
      throw new Error(`Schema for collection "${collectionName}" not found`);
    }

    const self = this;

    return {
      async create({ data, select = {}, include = {} }) {
        await self.initPromise;

        try {
          const validated = modelSchema.parse(data);
          const id = validated.id || crypto.randomUUID();
          validated.id = id;
          validated.createdAt = validated.createdAt || new Date();

          const key = [collectionName, id];
          await self.kv.set(key, validated);

          return self._processResult.call(
            self,
            { ...validated },
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
        await self.initPromise;

        const key = DenoKvClient.getKey(collectionName, where);
        const result = await self.kv.get(key);

        if (!result?.value) {
          return null;
        }

        return self._processResult.call(
          self,
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
      }) {
        await self.initPromise;

        const prefix = [collectionName];
        const entries = self.kv.list({ prefix });
        const results = [];
        let count = 0;

        for await (const entry of entries) {
          if (count++ < skip) continue;
          if (take && results.length >= take) break;

          if (DenoKvClient.matchesWhere(entry.value, where)) {
            const processed = await self._processResult.call(
              self,
              entry.value,
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
          hasMore: results.length === take,
        };
      },

      async update({ where, data, select = {}, include = {} }) {
        await self.initPromise;

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
          const relations = self.schema.getRelations(collectionName);

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

          await self.kv.set(key, updatedData);
          return self._processResult.call(
            self,
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
        await self.initPromise;

        const key = DenoKvClient.getKey(collectionName, where);
        const existingData = await this.findUnique({ where });

        if (!existingData) {
          return null;
        }

        try {
          const relations = self.schema.getRelations(collectionName);

          // Delete related records first, but only if they exist
          for (const [relationName, relationConfig] of Object.entries(
            relations
          )) {
            if (Array.isArray(relationConfig)) {
              const [targetModel, targetSchema, localKey, foreignKey] =
                relationConfig;
              const targetNamespace =
                self.namespaces.get(targetModel) || self.namespace(targetModel);

              // Use list to find and delete related records
              const prefix = [targetModel];
              const entries = self.kv.list({ prefix });

              for await (const entry of entries) {
                if (entry.value[foreignKey] === existingData.id) {
                  await self.kv.delete(entry.key);
                }
              }
            }
          }

          // Delete the main record
          await self.kv.delete(key);

          // Apply select if specified
          const result = {};
          if (Object.keys(select).length > 0) {
            for (const [field, included] of Object.entries(select)) {
              if (included && field in existingData) {
                result[field] = existingData[field];
              }
            }
            return result;
          }

          return existingData;
        } catch (error) {
          throw new Error(`Error deleting record: ${error.message}`);
        }
      },

      async deleteMany({ where = {} }) {
        await self.initPromise;

        const prefix = [collectionName];
        const entries = self.kv.list({ prefix });
        let count = 0;

        try {
          for await (const entry of entries) {
            if (DenoKvClient.matchesWhere(entry.value, where)) {
              await self.kv.delete(entry.key);
              count++;
            }
          }

          return { count };
        } catch (error) {
          throw new Error(`Error deleting records: ${error.message}`);
        }
      },

      async upsert({ where, create, update, select = {}, include = {} }) {
        await self.initPromise;

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
        await self.initPromise;

        const prefix = [collectionName];
        const entries = self.kv.list({ prefix });
        let count = 0;

        for await (const entry of entries) {
          if (DenoKvClient.matchesWhere(entry.value, where)) {
            count++;
          }
        }

        return count;
      },
    };
  }

  async _processResult(data, { select = {}, include = {} }, modelName) {
    if (!data) return null;

    let result = { ...data };

    if (Object.keys(include).length > 0) {
      const relations = this.schema.getRelations(modelName);
      const relationPromises = [];

      for (const [relationName, included] of Object.entries(include)) {
        if (!included || !relations[relationName]) continue;

        const [targetModel, targetSchema, localKey, foreignKey] =
          relations[relationName];
        const targetNamespace =
          this.namespaces.get(targetModel) || this.namespace(targetModel);

        if (Array.isArray(targetSchema)) {
          // Handle one-to-many relations
          relationPromises.push(
            (async () => {
              const relatedItems = await targetNamespace.findMany({
                where: { [foreignKey]: data[localKey] },
              });
              result[relationName] = relatedItems.data;
            })()
          );
        } else {
          // Handle one-to-one relations
          relationPromises.push(
            (async () => {
              const relatedItem = await targetNamespace.findUnique({
                where: { [foreignKey]: data[localKey] },
              });
              result[relationName] = relatedItem;
            })()
          );
        }
      }

      await Promise.all(relationPromises);
    }

    if (Object.keys(select).length > 0) {
      const selectedResult = {};
      for (const [field, included] of Object.entries(select)) {
        if (included && field in result) {
          selectedResult[field] = result[field];
        }
      }
      return selectedResult;
    }

    return result;
  }

  static getKey(collectionName, where) {
    const parts = [collectionName];
    for (const [key, value] of Object.entries(where)) {
      parts.push(value);
    }
    return parts;
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
