const pg = require('pg');
const conf = require('config');
if (conf.payment.db) {
    const client = new pg.Client(conf.payment.db);
    client.connect((err, client, done) => {
        // Handle connection errors
        if (err) {
            throw err;
        }
        client.query('CREATE TABLE IF NOT EXISTS cards(id serial PRIMARY KEY, owner VARCHAR(40) not null, externalId VARCHAR(40) not null, data json, response json, created_at TIMESTAMP DEFAULT NOW())');
    });

    function Card() {
        let _super = {
            insertCard: async ({owner, externalId, data, response}) => {
                let card = await client.query(
                    'INSERT into cards (owner, externalId, data, response) VALUES($1, $2, $3, $4) RETURNING id',
                    [owner, externalId, data, response],
                    function (err, result) {
                        if (err) {
                            // client.end();
                            console.log(err);
                        } else {
                            // client.end();
                            console.log('row inserted with id: ' + (result.rows[0] !== undefined) ? result.rows[0].id : 'err');
                        }
                    });
                return Promise.resolve(card)
            },
            getCards: async ({owner, order, page, limit}) => {
                let queryString = 'SELECT * FROM cards WHERE owner = '+"'"+owner+"'";
                if(order){
                    queryString += order[0] === '+' ? ' ORDER BY '+order.substr(1)+' ASC' : ' ORDER BY ${order.substr(1)} DESC'
                }
                if(page && limit){
                    let offset = limit*page;
                    queryString += ' LIMIT '+limit+ ' OFFSET '+offset
                }
                let cards = await client.query(queryString);
                return {total: cards.rowCount, cards: cards.rows}
            },

            getCard: async ({cardId}) => {
                let queryString = 'SELECT * FROM cards WHERE externalId = '+"'"+cardId+"'";
                let card = await client.query(queryString);
                return card.rows[0].data;
            },
        };
        return _super
    }

    exports.instance = Card
} else {
    exports.instance = null
}
