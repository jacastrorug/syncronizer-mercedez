import * as MSSQL from "mssql";
import * as MySQL from "mysql2";
import { AccessoryStock } from "../models/AccessoryStock";
import { Environment } from "../models/Environment";
import { PostMetaWP } from "../models/PostMetaWP";

export const getDNSConnection = async (): Promise<MSSQL.ConnectionPool> => {

    const sqlDNSConfig: MSSQL.config = {
        user: process.env.DB_DNS_USER,
        password: process.env.DB_DNS_PASSWORD,
        server: process.env.DB_DNS_SERVER ?? '',
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };

    return MSSQL.connect(sqlDNSConfig);
};

export const getStoreConnection = async (): Promise<MySQL.Connection> => {

    const sqlStoreConfig: MySQL.ConnectionOptions = {
        user: process.env.DB_LOAD_USER,
        password: process.env.DB_LOAD_PASSWORD,
        host: process.env.DB_LOAD_HOST,
    };

    return MySQL.createConnection(sqlStoreConfig);
}

export const parseAccesoryCode = (codigo: string): string => {
    const reg = /^[a-zA-Z0-9]*-DIS$/;
    if (!reg.test(codigo))
        return codigo;

    return codigo.split("-DSI")[0];
};

export const getStoreDBName = (): string => {
    if (process.env.SYNC_ENV !== Environment.PROD) {
        return process.env.DB_LOAD_NAME_DEV ?? '';
    }

    return process.env.DB_LOAD_NAME_PROD ?? '';
};

export const getStorePrefix = (): string => {
    if (process.env.SYNC_ENV !== Environment.PROD) {
        return process.env.DB_LOAD_PREFIX_DEV ?? '';
    }

    return process.env.DB_LOAD_PREFIX_PROD ?? '';
};

export const cleanStockAccessories = async (connection: MySQL.Connection) => {
    console.log(`Cleaning stock accessories...`);

    const storeDBName = getStoreDBName();
    const storeDBPrefix = getStorePrefix();

    const [result] = await connection.promise().query(`SELECT product_id, sku, stock_quantity, min_price, max_price FROM ${storeDBName}.${storeDBPrefix}_wc_product_meta_lookup WHERE sku != ''`);
    const accessories = result as AccessoryStock[];

    for (let accessory of accessories) {
        const [postMetaWP] = await connection.promise().query(`SELECT * FROM ${storeDBName}.${storeDBPrefix}_postmeta WHERE meta_key = ? AND post_id = ?`, [0, '_stock', accessory.sku]);
        const postMeta: PostMetaWP = postMetaWP[0];

        if (!postMeta) continue;

        await connection.promise().query(`UPDATE ${storeDBName}.${storeDBPrefix}_wp_postmeta SET meta_value = ? WHERE meta_key = ? AND post_id = ?`, [0, '_stock', postMeta.post_id]);
    }

    await connection.promise().query(`UPDATE ${storeDBName}.${storeDBPrefix}_wc_product_meta_lookup SET stock_quantity = ?`, [0]);

    console.log(`Accessories cleaned, every accessory has stock in 0`);
};

