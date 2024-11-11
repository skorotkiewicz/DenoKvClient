import { openKv } from "@deno/kv";

export default class DenoKvClient {
  constructor() {
    this.kv = null;

    // Proxy for dynamic namespace creation
    return new Proxy(this, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop];
        }

        // Creates a namespace if it does not already exist
        const namespace = target.namespace(prop);
        target[prop] = namespace;
        return namespace;
      },
    });
  }

  async init(url, accessToken) {
    this.kv = await openKv(url, { accessToken });
  }

  namespace(collectionName) {
    const kv = this.kv;
    return {
      async create({ data, select = {} }) {
        const id = data.username || data.name || `item_${Date.now()}`;
        const key = [collectionName, id];

        await kv.set(key, data);
        return DenoKvClient.applySelect(data, select);
      },

      async findUnique({ where, select = {} }) {
        const key = DenoKvClient.getKey(collectionName, where);
        const result = await kv.get(key);

        if (!result) {
          return null;
        }

        return DenoKvClient.applySelect(result.value, select);
      },

      async update({ where, data, select = {} }) {
        const key = DenoKvClient.getKey(collectionName, where);
        const existingData = await this.findUnique({ where });

        if (!existingData) {
          return null;
        }

        const updatedData = {
          ...existingData,
          ...data,
        };

        await kv.set(key, updatedData);
        return DenoKvClient.applySelect(updatedData, select);
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
    if (!data) {
      return null;
    }

    if (Object.keys(select).length === 0) {
      return data;
    }

    const projection = {};
    for (const [field, included] of Object.entries(select)) {
      if (included && field in data) {
        projection[field] = data[field];
      }
    }

    return projection;
  }
}
