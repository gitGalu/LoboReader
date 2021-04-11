import Dexie from 'dexie';

const DATABASE_NAME = 'LoboReader';
const DATABASE_VERSION = 4;

const db = new Dexie(DATABASE_NAME);

db.version(DATABASE_VERSION).stores({
    collection: 'id',
    acknowledgements: 'id'
});

export default db;