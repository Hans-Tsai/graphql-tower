import _ from 'lodash';
import knex, { client } from 'jest-mock-knex';
import Model, { ValueColumn } from 'graphql-tower-model';
import { toGlobalId } from 'graphql-tower-global-id';
import { NotFoundError } from 'graphql-tower-errors';
import { CacheModel } from '../';

process.setMaxListeners(0);

const database = knex({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    user: 'postgres',
    password: null,
    database: 'graphql_tower',
  },
});

class CarModel extends Model {
  static database = database;

  static tableName = 'car';

  static columns = {
    name: new ValueColumn(),
  }
}

class HouseModel extends Model {
  static database = database;

  static tableName = 'house';

  static columns = {
    name: new ValueColumn(),
  }
}

class Cache extends CacheModel {
  static car = CarModel;
  static house = HouseModel;
}

class TTLCache extends CacheModel {
  static ttl = true;
  static car = CarModel;
  static house = HouseModel;
}

describe('CacheModel', () => {
  afterAll(() => database.destroy());

  describe('load & loadMany', () => {
    it('cache 1', async () => {
      const cache = new Cache();

      client.mockReturnValueOnce([{ id: '1', name: '1 of car' }]);
      await cache.load(toGlobalId('car', '1'));

      client.mockReturnValueOnce([{ id: '1', name: '1 of house' }]);
      await cache.load(toGlobalId('house', '1'));

      client.mockReturnValueOnce([{ id: '3', name: '3 of car' }]);
      client.mockReturnValueOnce([{ id: '2', name: '2 of house' }, { id: '4', name: '4 of house' }]);

      await Promise.all([
        cache.load(toGlobalId('car', '1')),
        cache.load(toGlobalId('house', '2')),
        cache.loadMany([toGlobalId('car', '3'), toGlobalId('house', '1'), toGlobalId('house', '4')]),
      ]);

      expect(client).toMatchSnapshot();
      expect(client).toHaveBeenCalledTimes(4);
    });

    it('cache 2', async () => {
      const cache = new Cache();

      client.mockReturnValueOnce([{ id: '1', name: '1 of car' }]);
      await cache.load(toGlobalId('car', '1'));

      client.mockReturnValueOnce([{ id: '1', name: '1 of house' }]);
      await cache.load(toGlobalId('house', '1'));

      expect(client).toMatchSnapshot();
      expect(client).toHaveBeenCalledTimes(2);
    });
  });

  it('check type', async () => {
    const cache = new Cache();

    await expect(cache.load(toGlobalId('tree', '1'))).resolves.toBeNull();

    client.mockReturnValueOnce([]);
    await expect(cache.load(toGlobalId('car', '1'))).resolves.toBeNull();

    await expect(cache.load(toGlobalId('car', '1'), NotFoundError))
      .rejects.toEqual(new NotFoundError());

    client.mockReturnValueOnce([{ id: '2', name: '2 of car' }]);
    await expect(cache.load(toGlobalId('car', '2'), 'house')).resolves.toBeNull();

    await expect(cache.load(toGlobalId('car', '2'), 'house', NotFoundError))
      .rejects.toEqual(new NotFoundError());

    expect(client).toMatchSnapshot();
    expect(client).toHaveBeenCalledTimes(2);
  });

  describe('prime', async () => {
    it('when prime new data', async () => {
      const id = toGlobalId('car', '1');

      const cache = new Cache();

      cache.prime(id, CarModel.forge({ id: '1', name: '1 of car' }));
      await expect(cache.load(id))
        .resolves.toEqual(expect.objectContaining({ id, name: '1 of car' }));
      expect(client).toHaveBeenCalledTimes(0);

      cache.prime(id);
      client.mockReturnValueOnce([{ id: '1', name: '1 of car again' }]);
      await expect(cache.load(id))
        .resolves.toEqual(expect.objectContaining({ id, name: '1 of car again' }));
      expect(client).toHaveBeenCalledTimes(1);
    });

    it('when model does not exist', () => {
      const cache = new Cache();
      cache.dataloader = jest.fn();
      cache.prime(toGlobalId('tree', '1'));

      expect(cache.dataloader).toHaveBeenCalledTimes(0);
    });
  });

  it('clear & clearAll', async () => {
    const cache = new Cache();

    client.mockReturnValueOnce([{ id: '1', name: '1 of car' }]);
    client.mockReturnValueOnce([{ id: '1', name: '1 of car' }]);
    client.mockReturnValueOnce([{ id: '1', name: '1 of car' }]);

    await cache.load(toGlobalId('car', '1'));
    await cache.load(toGlobalId('car', '1'));
    cache.clear(toGlobalId('car', '1'));
    await cache.load(toGlobalId('car', '1'));
    cache.clearAll();
    await cache.load(toGlobalId('car', '1'));

    expect(client).toMatchSnapshot();
    expect(client).toHaveBeenCalledTimes(3);
  });

  it('new model', async () => {
    const cache = new Cache();
    const { car } = cache;

    client.mockReturnValueOnce([{ id: '1', name: '1 of car' }, { id: '2', name: '2 of car' }]);
    expect(_.size(await car.fetchAll())).toBe(2);

    await cache.load(toGlobalId('car', '1'));

    expect(client).toMatchSnapshot();
    expect(client).toHaveBeenCalledTimes(1);
  });

  describe('TTLCache', () => {
    it('cache', async () => {
      const cache = new TTLCache();

      client.mockReturnValueOnce([{ id: '1', name: '1 of car' }]);
      await cache.load(toGlobalId('car', '1'));

      client.mockReturnValueOnce([{ id: '1', name: '1 of house' }]);
      await cache.load(toGlobalId('house', '1'));

      client.mockReturnValueOnce([{ id: '3', name: '3 of car' }]);
      client.mockReturnValueOnce([{ id: '2', name: '2 of house' }, { id: '4', name: '4 of house' }]);

      await Promise.all([
        cache.load(toGlobalId('car', '1')),
        cache.load(toGlobalId('house', '2')),
        cache.loadMany([toGlobalId('car', '3'), toGlobalId('house', '1'), toGlobalId('house', '4')]),
      ]);

      expect(client).toMatchSnapshot();
      expect(client).toHaveBeenCalledTimes(4);
    });
  });
});