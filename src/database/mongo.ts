import { MongoClient, Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

const DB_NAME = process.env.MONGODB_DB_NAME || "billiard-club";

export async function connectToMongo(): Promise<Db> {
    if (db) return db;

    const uri = process.env.MONGODB_URI!;
    client = new MongoClient(uri);
    await client.connect();

    db = client.db(DB_NAME);

    //It is safe to run this every time (operations are idempotent)
    await initializeDatabase(db);

    return db;
}

async function initializeDatabase(database: Db) {
    const members = database.collection("members");
    const checkins = database.collection("checkins");

    // MEMBERS TABLE RULES
    await members.createIndex(
        { email: 1 },
        { unique: true, name: "unique_email" }
    );

    await members.createIndex(
        { qrUuid: 1 },
        { unique: true, name: "unique_qr_uuid" }
    );

    // CHECKINS TABLE RULES
    await checkins.createIndex(
        { memberId: 1 },
        { name: "index_member_lookup" }
    );

    await checkins.createIndex(
        { checkinTime: -1 },
        { name: "index_time_sort" }
    );
}

