const {request, app} = require('../../config');
const FakerUser = require('../../Faker/User.js');
const {config} = require('../../config');
const TravelsData = require('../../Mock/TravelsData.js');
const appId = config.appId;

let sessionTokenPassenger, distance, duration, sessionTokenAdmin, sessionTokenDriver, driverId, fareId, travelId1,
    placeId, value, destiny, origin, valueDriver;
let minValue = 5;

it('should login with admin', done => {
    request(app).post('/use/functions/logIn')
        .send({
            _ApplicationId: appId,
            login: "Talita.Moreira51@bol.com.br",
            password: "4kBlduiO6V7jddJ"
        }).end((err, res) => {
        expect(res ? res.status : 'error').toEqual(200);
        sessionTokenAdmin = res.body.result.sessionToken;
        done(err);
    });
}, 10000);

describe('Get data from db', () => {
    it('should list passengers', done => {
        request(app).post('/use/functions/listUsers')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.totalPassengers).toBeGreaterThan(0);
               //res.body.result.passengers
                done(err);
            });
    }, 50000);

    it('should list drivers', done => {
        request(app).post('/use/functions/listDrivers')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.totalDrivers).toBeGreaterThan(0);
                //res.body.result.drivers
                done(err);
            });
    }, 50000);

    it('should list radius', done => {
        request(app).post('/use/functions/listRadius')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.total).toBeGreaterThan(0);
                //res.body.result.radius
                done(err);
            });
    }, 50000);

});

xdescribe('Complete Travel paying with money', () => {
    describe('List Travel options', () => {

        it('should turn a driver available', done => {
            request(app).post('/use/functions/updateBasicData')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    latitude: -20.246145,
                    longitude: -43.804937,
                    offset: -180,
                    appIdentifier: driver[0].appIdentifier,
                    installationId: driver[0].installationId,
                    deviceType: driver[0].deviceInfo.deviceType,
                    deviceToken: driver[0].deviceToken
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result).toEqual("Você esta pronto para receber chamadas!");
                    done(err);
                });
        }, 90000);

        it('should list travel options', done => {
            placeId = TravelsData.autocompletePlacesMock3();
            origin = TravelsData.getRouteMock3().origin;
            destiny = TravelsData.getRouteMock3().destiny;
            distance = TravelsData.getRouteMock3().distance;
            duration = TravelsData.getRouteMock3().duration;
            request(app).post('/use/functions/listTravelOptions')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenPassenger,
                    city: 'Itabirito',
                    distance: distance,
                    location:
                        {
                            latitude: -20.241037,
                            longitude: -43.803765
                        },
                    offset: -180,
                    state: 'Minas Gerais',
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.fares.length > 0).toEqual(true);
                    let index;
                    for (let i = 0; i < res.body.result.fares.length; i++) {
                        if (res.body.result.fares[i].type === "Comum") {
                            index = i;
                            break;
                        }
                    }
                    expect(res.body.result.fares[index].price).toEqual(parseFloat((5 + distance * 7 + duration * 2).toFixed(2)));
                    fareId = res.body.result.fares[index].objectId;
                    value = res.body.result.fares[index].price;
                    done(err);
                });
        }, 10000);

        it('should request travel flow', done => {
            request(app).post('/use/functions/requestTravelFlow')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenPassenger,
                    value: value,
                    fareId: fareId,
                    destination: destiny,
                    origin: origin,
                    distance: distance,
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId !== undefined).toEqual(true);
                    travelId1 = res.body.result.objectId;
                    done(err);
                });
        }, 50000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenPassenger,
                    objectId: travelId1,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.status).toEqual('new');
                    done(err);
                });
        }, 10000);
    });

    describe('Travel Flow', () => {
        it('should accept travel flow', done => {
            setTimeout(() => {
                request(app).post('/use/functions/acceptTravel')
                    .send({
                        _ApplicationId: appId,
                        _SessionToken: sessionTokenDriver,
                        objectId: travelId1,
                        offset: -180
                    })
                    .end((err, res) => {
                        expect(res ? res.status : 'error').toEqual(200);
                        done(err);
                    });
            }, 10000);
        }, 100000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenPassenger,
                    objectId: travelId1,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.status).toEqual('onTheWay');
                    done(err);
                });
        }, 10000);

        it('should init travel', done => {
            request(app).post('/use/functions/initTravel')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    objectId: travelId1,
                    offset: -180
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    done(err);
                });
        }, 100000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenPassenger,
                    objectId: travelId1,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.status).toEqual('onTheDestination');
                    done(err);
                });
        }, 10000);

        it('should complete travel', done => {
            request(app).post('/use/functions/completeTravel')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    objectId: travelId1,
                    offset: -180,
                    latitude: -20.2500669,
                    longitude: -43.8041901

                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    valueDriver = res.body.result.valueDriver;
                    done(err);
                });
        }, 100000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenPassenger,
                    objectId: travelId1,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.status).toEqual('completed');
                    done(err);
                });
        }, 10000);

        it('should list travels with passenger', done => {
            request(app).post('/use/functions/listTravels')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenPassenger,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.totalTravels).toEqual(1);
                    expect(res.body.result.travels[0].objectId).toEqual(travelId1);
                    expect(res.body.result.travels[0].status).toEqual("completed");
                    done(err);
                });
        }, 10000);

        it('should list travels with driver', done => {
            request(app).post('/use/functions/listTravels')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.totalTravels).toEqual(1);
                    expect(res.body.result.travels[0].objectId).toEqual(travelId1);
                    expect(res.body.result.travels[0].status).toEqual("completed");
                    done(err);
                });
        }, 10000);

        it('should get driver by id', done => {
            request(app).post('/use/functions/getDriverById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenAdmin,
                    userId: driverId
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.user.inDebt).toEqual(0);
                    done(err);
                });
        }, 10000);
    });
});