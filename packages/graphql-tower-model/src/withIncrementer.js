import _ from 'lodash';

export default Parent => class Incrementer extends Parent {
  async increment(key, difference, operator) {
    const { database, signify } = this.constructor;
    const values = signify(_.mapValues(
      _.isPlainObject(key) ? key : _.set({}, [key], difference),
      _.toNumber,
    ));

    const changes = _.mapValues(values,
      (value, column) => database.raw(`${column} + ?`, [value]));

    return super.update(changes, operator);
  }
};
