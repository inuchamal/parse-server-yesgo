const {request, app, config} = require('../../config');
const FakerUser = require('../../Faker/User.js');
const appId = config.appId;
let passenger = FakerUser.createPassengers(1);
let driver = FakerUser.createDrivers(1);

const passengerLogin = {
    _ApplicationId: appId,
    login: passenger[0].email,
    password: passenger[0].password
};

const driverLogin = {
    _ApplicationId: appId,
    login: driver[0].email,
    password: driver[0].password
};

describe('First Steps', () => {
    it('should accept register a passenger', done => {
        request(app).post('/use/functions/signUpPassenger')
            .send(passenger[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                if (config.ignoreAppNameInCode) {
                    expect(res.body.result.indicationCode).not.toMatch(config.appName.toUpperCase());
                } else {
                    expect(res.body.result.indicationCode).toMatch(config.appName.toUpperCase());
                }
                done(err);
            });
    }, 10000);
    it('should accept login with the registered passenger', done => {
        request(app).post('/use/functions/logInPassenger')
            .send(passengerLogin)
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                if (config.ignoreAppNameInCode) {
                    expect(res.body.result.indicationCode).not.toMatch(config.appName.toUpperCase());
                } else {
                    expect(res.body.result.indicationCode).toMatch(config.appName.toUpperCase());
                }
                done(err);
            });
    }, 10000);
});

describe('Create Driver', () => {
    it('should accept register a driver', done => {
        request(app).post('/use/functions/signUpDriver')
            .send(driver[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                if (config.ignoreAppNameInCode) {
                    expect(res.body.result.indicationCode).not.toMatch(config.appName.toUpperCase());
                } else {
                    expect(res.body.result.indicationCode).toMatch(config.appName.toUpperCase());
                }
                done(err);
            });
    }, 10000);
    it('should accept login with the registered driver', done => {
        request(app).post('/use/functions/logInPassenger')
            .send(driverLogin)
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                if (config.ignoreAppNameInCode) {
                    expect(res.body.result.indicationCode).not.toMatch(config.appName.toUpperCase());
                } else {
                    expect(res.body.result.indicationCode).toMatch(config.appName.toUpperCase());
                }
                done(err);
            });
    }, 10000);
});