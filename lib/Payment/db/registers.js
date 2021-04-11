const pg = require('pg');
const conf = require('config');
if (conf.payment.db) {
    const client = new pg.Client(conf.payment.db);
    client.connect((err, client, done) => {
        // Handle connection errors
        if (err) {
            throw err;
        }
        client.query('CREATE TABLE IF NOT EXISTS registers(id serial PRIMARY KEY, type VARCHAR(40) not null, userId VARCHAR(40) not null, targetId VARCHAR(40), request json, response json, created_at TIMESTAMP DEFAULT NOW())');
    });
    function Register() {
        let _super = {
            insertRegister: async ({type, request, response, userId, targetId}) => {
                client.query(
                    'INSERT into registers (type, userId, request, response) VALUES($1, $2, $3, $4) RETURNING id',
                    [type, userId, request, response],
                    function (err, result) {
                        if (err) {
                            console.log(err);
                            client.end();
                        } else {
                            client.end();
                            // console.log('row inserted with id: ' + result.rows[0].id);
                        }
                    });

            },
        }
        return _super
    }

    exports.instance = Register
} else {
    exports.instance = null
}
