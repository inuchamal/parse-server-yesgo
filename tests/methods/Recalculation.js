const {request, app} = require('../config');
const {config} = require('../config');
const appId = config.appId;

let sessionTokenAdmin;

describe('Login Admin', () => {
    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                sessionTokenAdmin = res.body.result.sessionToken;
                done(err);
            });
    }, 50000);
});

describe('Set recalculate in Config', () => {
    it('should set recalculate with values', done => {
        request(app).post('/use/functions/setRecalculate')
            .send({
                "_ApplicationId": appId,
                "_SessionToken": sessionTokenAdmin,
                "enabled": true,
                "minDiffKm": 1,
                "minDiffMinutes": 10,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);
    it('should get recalculate with values', done => {
        request(app).post('/use/functions/getRecalculate')
            .send({
                "_ApplicationId": appId,
                "_SessionToken": sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.enabled).toEqual(true);
                expect(res.body.result.minDiffKm).toEqual(1);
                expect(res.body.result.minDiffMinutes).toEqual(10);
                done(err);
            });
    }, 10000);
});

describe('Set recalculate in Config', () => {
    it('should set recalculate disabled', done => {
        request(app).post('/use/functions/setRecalculate')
            .send({
                "_ApplicationId": appId,
                "_SessionToken": sessionTokenAdmin,
                "enabled": false
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);
    it('should get recalculate disabled', done => {
        request(app).post('/use/functions/getRecalculate')
            .send({
                "_ApplicationId": appId,
                "_SessionToken": sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.enabled).toEqual(false);
                expect(res.body.result.minDiffKm).toBeUndefined();
                expect(res.body.result.minDiffMinutes).toBeUndefined();
                done(err);
            });
    }, 10000);
});
