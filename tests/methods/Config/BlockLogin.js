const {request, app} = require('../../config');
const FakerUser = require('../../Faker/User.js');
const {config} = require('../../config');
const firebase = require('firebase');

const appId = config.appId;
const blockLoginAcrossPlatform = config.blockLoginAcrossPlatform || false;

let typeSplitCall = "";
let customizeTitle = "";

let sessionToken, idPassenger, distance, duration, sessionTokenAdmin, sessionTokenDriver, catId, docId,
    userDocId, userId, fareId, travelId, placeId, docs, value, destiny, origin;

let passenger = FakerUser.createPassengers(1);
let driver = FakerUser.createDrivers(1);

let passengerLogin = {
    _ApplicationId: appId,
    login: passenger[0].email,
    password: passenger[0].password
};

let driverLogin = {
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
                expect(res.body.result.objectId !== undefined).toEqual(true);
                expect(res.body.result.sessionToken !== undefined).toEqual(true);
                done(err);
            });
    }, 10000);

    it('should accept register a driver', done => {
        request(app).post('/use/functions/signUpDriver')
            .send(driver[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId !== undefined).toEqual(true);
                expect(res.body.result.sessionToken !== undefined).toEqual(true);
                done(err);
            });
    }, 10000);
});

customizeTitle = "Block Login Across Platform - " + (blockLoginAcrossPlatform ? "Enabled" : "Disabled");

describe(customizeTitle, () => {
    if (blockLoginAcrossPlatform) {
        it('should not accept a passenger user login in the driver app', done => {
            request(app).post('/use/functions/logInPassenger')
                .send(driverLogin)
                .end((err, res) => {
                    expect(res ? res.status !== 200 : true).toEqual(true);
                    done(err);
                });
        }, 10000);
        it('should not accept a driver user login in the passenger app', done => {
            request(app).post('/use/functions/logInDriver')
                .send(passengerLogin)
                .end((err, res) => {
                    expect(res ? res.status !== 200 : true).toEqual(true);
                    done(err);
                });
        }, 10000);
    } else {
        it('should accept a passenger user login in the driver app', done => {
            request(app).post('/use/functions/logInPassenger')
                .send(driverLogin)
                .end((err, res) => {
                    expect(res ? res.status : "error").toEqual(200);
                    done(err);
                });
        }, 10000);
        it('should accept a driver user login in the passenger app', done => {
            request(app).post('/use/functions/logInDriver')
                .send(passengerLogin)
                .end((err, res) => {
                    expect(res ? res.status : "error").toEqual(200);
                    done(err);
                });
        }, 10000);
    }
});

if (config.splitCall) {
    let {splitCall} = config;
    if (splitCall.countReceivers && splitCall.splitTimeInSeconds) {
        typeSplitCall = "Fila";
        if (splitCall.callAllAfter && splitCall.secondLimitAfterCallAll)
            typeSplitCall = "Fila/Leilão";
    }
} else {
    typeSplitCall = "Leilão";
}

customizeTitle = "Split Call - " + typeSplitCall;

describe(customizeTitle, () => {
   switch (typeSplitCall.toLowerCase()) {
       case "fila": break;
       case "fila/leilão": break;
       default:
           break;
   }
});



