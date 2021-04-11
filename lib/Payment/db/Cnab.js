const pg = require('pg');
const conf = require('config');
if (conf.payment.db) {
    const client = new pg.Client(conf.payment.db);
    client.connect((err, client, done) => {
        // Handle connection errors
        if (err) {
            throw err;
        }
        client.query('CREATE TABLE IF NOT EXISTS cnabs(id serial PRIMARY KEY not null, data json, created_at TIMESTAMP DEFAULT NOW())');
    });

    function Cnab() {
        let _super = {
            insertCnab: async ({owner, externalId, data, response}) => {
                let cnab = await client.query(
                    'INSERT into cnabs (data) VALUES($1) RETURNING id',
                    [data],
                    function (err, result) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('row inserted with id: ' + result.rows[0].id);
                        }
                    });
                return Promise.resolve(cnab)
            },
            getCnabs: async ({id, order, page, limit}) => {
                let queryString = 'SELECT * FROM cnabs WHERE id = '+"'"+id+"'";
                if(order){
                    queryString += order[0] === '+' ? ' ORDER BY '+order.substr(1)+' ASC' : ' ORDER BY ${order.substr(1)} DESC'
                }
                if(page && limit){
                    let offset = limit*page;
                    queryString += ' LIMIT '+limit+ ' OFFSET '+offset
                }
                let cnabs = await client.query(queryString)
                return {total: cnabs.rowCount, cnabs: cnabs.rows}
            },
        }
        return _super
    }

    exports.instance = Cnab
} else {
    exports.instance = null
}
