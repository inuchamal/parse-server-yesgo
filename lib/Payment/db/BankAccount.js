const pg = require('pg');
const conf = require('config');
if (conf.payment.db) {
    const client = new pg.Client(conf.payment.db);
    client.connect((err, client, done) => {
        // Handle connection errors
        if (err) {
            throw err;
        }
        client.query('CREATE TABLE IF NOT EXISTS bankaccounts(id serial PRIMARY KEY, owner VARCHAR(40) not null, data json, response json, created_at TIMESTAMP DEFAULT NOW())');
    });

    function Bankaccount() {
        let _super = {
            insertBankaccount: async ({owner, data, response}) => {
                let bankaccount = await client.query(
                    'INSERT into bankaccounts (owner, data, response) VALUES($1, $2, $3) RETURNING id',
                    [owner, data, response],
                    function (err, result) {
                        if (err) {
                            // client.end();
                            console.log(err);
                        } else {
                            // client.end();
                            console.log('row inserted with id: ' + result.rows[0].id);
                        }
                    });
                return Promise.resolve(bankaccount)
            },
            getBankaccounts: async ({owner, order, page, limit}) => {
                let queryString = 'SELECT * FROM bankaccounts WHERE owner = ' + "'" + owner + "'";
                if (order) {
                    queryString += order[0] === '+' ? ' ORDER BY ' + order.substr(1) + ' ASC' : ' ORDER BY ' + order.substr(1) + ' DESC'
                }
                if (page && limit) {
                    let offset = limit * page;
                    queryString += ' LIMIT ' + limit + ' OFFSET ' + offset
                }
                let bankaccounts = await client.query(queryString)
                return {total: bankaccounts.rowCount, bankaccounts: bankaccounts.rows}
            },
            updateBankaccounts: async ({owner, data}) => {
                data = JSON.stringify(data)
                let queryString = 'UPDATE bankaccounts SET data = ' + "'" + data + "'" + ' WHERE owner = ' + "'" + owner + "'";

                let bankaccounts = await client.query(queryString)
                return Promise.resolve()
            },
        }
        return _super
    }

    exports.instance = Bankaccount
} else {
    exports.instance = null
}
