const pg = require('pg');
const conf = require('config');
const utils = require('../../Utils');
if (conf.payment.db) {
    const client = new pg.Client(conf.payment.db);
    client.connect((err, client, done) => {
        // Handle connection errors
        if (err) {
            throw err;
        }
        client.query('CREATE TABLE IF NOT EXISTS transactions(id serial PRIMARY KEY, type VARCHAR(40) not null, userId VARCHAR(40) not null, targetId VARCHAR(40), request json not null, response json, externalRequest json, externalResponse json, created_at TIMESTAMP DEFAULT NOW(), driverValue FLOAT, originalvalue FLOAT, status VARCHAR(40), captureResponse json, transactionId VARCHAR(40), isCancellation BOOLEAN,  travelId VARCHAR(40));').then(() => {
            client.query("ALTER TABLE transactions ADD COLUMN originalvalue FLOAT;").then((s) => {
                client.query("ALTER TABLE transactions ADD COLUMN iscancellation BOOLEAN;");
                console.log(s)
            }, (e) => {
                client.query("ALTER TABLE transactions ADD COLUMN iscancellation BOOLEAN;");
                console.log(e)
            });
        });
    });

    function Transaction() {
        let _super = {
            insertTransaction: async ({type, request, response, externalRequest, externalResponse, userId, targetId, status, transactionId, travelId, value, originalvalue, isCancellation}) => {
                type = type || 'travel_card';
                await client.query(
                    'INSERT into transactions (type, userId, request, response, externalRequest, externalResponse, transactionId, travelId, status, targetId, drivervalue, originalvalue, iscancellation) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
                    [type, userId, request, response, externalRequest, externalResponse, transactionId, travelId, status, targetId, value, originalvalue, isCancellation],
                    function (err, result) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('row inserted with id: ' + result.rows[0].id);
                        }
                    });
            },
            insertMoneyTransaction: async ({type, request, response, externalRequest, externalResponse, userId, targetId, status, transactionId, travelId, driverValue, originalvalue, isCancellation}) => {
                type = type || 'travel_money';
                await client.query(
                    'INSERT into transactions (type, userId, request, response, externalRequest, externalResponse, transactionId, travelId, targetId, driverValue, status, originalvalue, iscancellation) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
                    [type, userId, request, response, externalRequest, externalResponse, transactionId, travelId, targetId, driverValue, status, originalvalue, isCancellation],
                    function (err, result) {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log('row inserted with id: ' + result.rows[0].id);
                        }
                    });
            },
            getCardSum: async ({userId}) => {
                try {
                    const query = "SELECT SUM(drivervalue) FROM transactions WHERE targetid = '" + userId + "' AND status = 'captured' AND type = 'travel_card';"
                    return await client.query(query)
                } catch (e) {
                    console.log(e)
                }
            },
            insertWithDrawTransaction: async ({type, request, response, externalRequest, externalResponse, userId, targetId, status, transactionId, travelId, driverValue, originalvalue}) => {
                type = type || 'withdraw';
                try {
                    await client.query(
                        'INSERT into transactions (type, userId, request, response, externalRequest, externalResponse, transactionId, travelId, targetId, driverValue, status, originalvalue) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id',
                        [type, userId, request, response, externalRequest, externalResponse, transactionId, travelId, targetId, driverValue, status, originalvalue],
                        function (err, result) {
                            if (err) {
                                console.log(err);
                            } else {
                                console.log('row inserted with id: ' + result.rows[0].id);
                            }
                        });
                } catch (e) {
                    console.log('row inserted with id: ' + result.rows[0].id);
                }
            },
            getTransactionsByTypeOrStatus: async ({type, status, id}) => {
                let queryString = 'SELECT * FROM transactions WHERE ';
                if (type) {
                    queryString += 'type = ' + "'" + type + "'"
                }
                if (status) {
                    queryString += type ? ' AND status = ' + "'" + status + "'" : ' status = ' + "'" + status + "'"
                }
                if (id) {
                    queryString += (status || type) ? ' AND targetid = ' + "'" + id + "'" : ' targetid = ' + "'" + id + "'"
                }
                let cards = await client.query(queryString);
                return {total: cards.rowCount, transactions: cards.rows}
            },
            getTransactionsByUser: async ({type, status, userId, startDate, endDate, limit, page, types}) => {
                let queryString = 'SELECT *, count(*) OVER() AS full_count, sum(drivervalue) OVER() AS total_value FROM transactions WHERE targetId = ' + "'" + userId + "' ";
                if (type) {
                    queryString += 'AND type = ' + "'" + type + "'"
                } else if (types) {
                    queryString += 'AND type in (';
                    for (let i = 0; i < types.length; i++) {
                        queryString += "'" + types[i] + "',"
                    }
                    queryString = queryString.substr(0, queryString.length-1);
                    queryString += ")"
                }
                if (status) {
                    queryString += type ? 'AND status = ' + "'" + status + "'" : ' status = ' + "'" + status + "'"
                }
                if (status) {
                    queryString += (type || status) ? 'AND targetId = ' + "'" + userId + "'" : ' targetId = ' + "'" + userId + "'"
                }
                if (startDate && endDate) {
                    startDate = new Date(startDate);
                    endDate = new Date(endDate);
                    queryString += ((queryString.length > 33) ? ' AND created_at >= ' + "'" + utils.convertDateToPsql(startDate) + "'" + ' AND created_at <= ' + "'" + utils.convertDateToPsql(endDate) + "'" : ' AND created_at >= ' + "'" + utils.convertDateToPsql(startDate) + "'" + 'AND created_at <= ' + "'" + utils.convertDateToPsql(endDate) + "'")
                }
                queryString += ' ORDER BY created_at DESC ';
                if (limit && (page !== undefined)) {
                    queryString += ' LIMIT ' + limit + ' OFFSET ' + page * limit
                }
                if (!type && !status && !(startDate && endDate)) queryString += 'targetId = ' + "'" + userId + "'";
                let cards = await client.query(queryString);
                return {
                    total: cards.rows[0] ? cards.rows[0].full_count : 0,
                    totalValue: cards.rows[0] ? cards.rows[0].total_value : 0,
                    transactions: cards.rows
                }
            },
            captureTransaction: async ({id, driverValue, captureResponse, status, targetId, originalvalue}) => {
                try {
                    let resp = captureResponse.length ? JSON.stringify(captureResponse[0]) : JSON.stringify(captureResponse);
                    let qString = "UPDATE transactions SET captureResponse =" + "'" + resp + "', " + "originalvalue = " + (originalvalue ? originalvalue : 0)  + ", driverValue = " + (driverValue ? driverValue : 0) + ", status = " + "'" + status + "'" + ", targetId = " + "'" + (targetId ? targetId : 'x') + "'" + " WHERE transactionId = " + "'" + id + "'";
                    let res = await client.query(qString);
                    return Promise.resolve(res)
                } catch (e) {
                    return Promise.resolve()
                }
            },
            changeTransaction: async ({id, driverValue, captureResponse, status, targetId}) => {
                try {
                    let resp = captureResponse.length ? JSON.stringify(captureResponse[0]) : JSON.stringify(captureResponse);
                    let qString = "UPDATE transactions SET captureResponse =" + "'" + resp + "'" + ", status = " + "'" + status + "'" + " WHERE id = " + id;
                    let res = await client.query(qString);
                    return Promise.resolve(res)
                } catch (e) {
                    return Promise.resolve()
                }
            },
            completeWithraw: {},
        };
        return _super
    }

    exports.instance = Transaction
} else {
    exports.instance = null
}
