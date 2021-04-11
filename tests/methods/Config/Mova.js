const {request, app, config} = require('../../config');
const FakerUser = require('../../Faker/User.js');
const FakerCard = require('../../Faker/Card.js');
const TravelsData = require('../../Mock/TravelsData.js');

const appId = config.appId;
const hasCancellation = config.hasCancellation || true;

let sessionToken, idPassenger, distance, duration, sessionTokenAdmin, sessionTokenDriver, catId, docId,
    userId, fareId, travelId, placeId, docs, value, destiny, origin, valueDriver, planId, listPlans;

let minValue = 6;
let creditDriver = 100;
let debtDriver = -10;
let passenger = FakerUser.createPassengers(1);
let driver = FakerUser.createDrivers(1);

let passenger2 = FakerUser.createPassengers(1);
let driver2 = FakerUser.createDrivers(1);

let passengerLogin = {
    _ApplicationId: appId,
    login: passenger[0].email,
    password: passenger[0].password
};

let passengerLogin2 = {
    _ApplicationId: appId,
    login: passenger2[0].email,
    password: passenger2[0].password
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
    }, 50000);

    it('should accept login with the registered passenger', done => {
        request(app).post('/use/functions/logInPassenger')
            .send(passengerLogin)
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId !== undefined).toEqual(true);
                expect(res.body.result.sessionToken !== undefined).toEqual(true);
                idPassenger = res.body.result.objectId;
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    }, 50000);
});

describe('Create Driver', () => {

    it('should accept register a driver', done => {
        request(app).post('/use/functions/signUpDriver')
            .send(driver[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                sessionTokenDriver = res.body.result.sessionToken;
                userId = res.body.result.objectId;
                done(err);
            });
    }, 10000);

    it('should validate the code', done => {
        request(app).post('/use/functions/validateCode')
            .send({
                _ApplicationId: appId,
                code: '3691',
                _SessionToken: sessionTokenDriver
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should accept legal consent', done => {
        request(app).post('/use/functions/signLegalConsent')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should accept complete driver profile', done => {
        request(app).post('/use/functions/completeProfile')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                name: driver[0].name,
                lastName: driver[0].name,
                birthDate: "12/08/93",
                city: "Belo Horizonte"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

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

    it('should create a category', done => {
        request(app).post('/use/functions/createCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "Econômico",
                description: "Categoria econômica",
                description_en: "Topper car",
                icon: "icon.png",
                percentCompany: 10,
                type: "common",
                minCapacity: 1,
                maxCapacity: 4,
                active: true,
                year: "2008"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                catId = res.body.result.objectId;
                done(err);
            });
    }, 10000);

    it('should add category to vehicle', done => {
        request(app).post('/use/functions/addCategoryToVehicle')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                catId: catId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should update the vehicle data', done => {
        request(app).post('/use/functions/updateVehicleData')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                model: "CG",
                year: "2018",
                color: "vermelho",
                plate: "HJGW1234",
                brand: "test"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should create a document', done => {
        request(app).post('/use/functions/createDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "CPF",
                description: "CADASTRO DE PESSOA FÍSICA",
                required: true,
                link: "Link com a descrição das instruções de como tirar a foto do documento..."
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    //Lista documentos ainda não enviados
    it('should list documents the driver need to send', done => {
        request(app).post('/use/functions/listDocsSent')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                docs = res.body.result;
                done(err);
            });
    }, 10000);

    it('should update the incomplete user data', done => {
        for (let i in docs) {
            docId = docs[i].objectId;
            request(app).post('/use/functions/createUserDoc')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    docId: docId,
                    link: "link que representa a foto do meu documento .png"
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    done(err);
                });
        }
    }, 10000);

    it('should get driver by id', done => {
        request(app).post('/use/functions/getDriverById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should approve user document', done => {
        request(app).post('/use/functions/approveUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should create bank account ', done => {
        request(app).post('/use/functions/createBankAccount')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                account: "00010838",
                accountDigit: "3",
                agency: "2229",
                bankCode: "104",
                cpf: "125.535.276-08",
                name: "Axel",
                type: "conta_poupanca"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should add debt to driver', done => {
        request(app).post('/use/functions/eraseInDebt')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                driverId: userId,
                amount: debtDriver
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should get driver by id', done => {
        request(app).post('/use/functions/getDriverById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                if(config.blockDriversInDebt)
                    expect(res.body.result.user.blockedByDebt).toEqual(true);
                    expect(res.body.result.user.inDebt).toEqual(10);
                done(err);
            });
    }, 10000);
});

describe('Create Radius and Fare', () => {
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

    it('should create radius', done => {
        request(app).post('/use/functions/createRadius')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                distance: 9000000,
                city: "Belo Horizonte",
                state: "Minas Gerais"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId !== undefined).toEqual(true);
                expect(res.body.result.message).toEqual("O objeto foi criado com sucesso");
                done(err);

            });
    }, 50000);

    it('should create fare', done => {
        request(app).post('/use/functions/createFare')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                catId: catId,
                name: "Táxi de beagá",
                days: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab"],
                time: "00:00-23:59",
                minValue: minValue,
                value: 8,
                valueKm: 1.5,
                valueTime: 10,
                additionalFee: 0,
                active: true
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId !== undefined).toEqual(true);
                expect(res.body.result.message).toEqual("O objeto foi criado com sucesso");
                done(err);
            });
    }, 50000);
});

describe('Set correct Plan', () => {
    it('should list plans', done => {
        request(app).post('/use/functions/listPlans')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            listPlans = res.body.result.plans;
            done(err);
        });
    }, 10000);

    it('should delete plan', done => {
        for (let i = 0; i < listPlans.length; i++) {
            planId = listPlans[i].objectId;
            request(app).post('/use/functions/deletePlan')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenAdmin,
                    planId: planId
                }).end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
        }

    }, 10000);

    it('should create plan', done => {
        request(app).post('/use/functions/createPlan')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                default: true,
                period: 'por mês',
                description: 'Descrição do plano do Mova',
                percent: 0,
                retention: 1,
                active: true,
                name: 'Mova Plan',
                value: 49.99,
                duration: 60
            }).end((err, res) => {
            expect(res ? res.status : 'error').toEqual(200);
            done(err);
        });
    }, 10000);
});

describe('Cannot complete travel because inDebt is positive', () => { //Catedral Nossa Senhora da Boa viagem -> Praça da Liberdade
    describe('List Travel options', () => {

        //turn a driver available
        it('should turn a driver available', done => {
            request(app).post('/use/functions/updateBasicData')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    latitude: -19.927457,
                    longitude: -43.942367,
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
        }, 10000);

        it('should list travel options', done => {
            placeId = TravelsData.autocompletePlacesMock2();
            origin = TravelsData.getRouteMock2().origin;
            destiny = TravelsData.getRouteMock2().destiny;
            distance = TravelsData.getRouteMock2().distance;
            duration = TravelsData.getRouteMock2().duration;
            request(app).post('/use/functions/listTravelOptions')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    city: 'Belo Horizonte',
                    distance: distance,
                    location:
                        {
                            latitude: -19.9319811,
                            longitude: -43.9380019
                        },
                    offset: -180,
                    state: 'Minas Gerais',
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.fares.length > 0).toEqual(true);
                    let index = undefined;
                    for (let i = 0; i < res.body.result.fares.length; i++) {
                        if (res.body.result.fares[i].type === "Econômico") {
                            index = i;
                            break;
                        }
                    }
                    expect(res.body.result.fares[index].price).toEqual(parseFloat((8 + distance * 1.5 + duration * 10).toFixed(2)));
                    fareId = res.body.result.fares[index].objectId;
                    value = res.body.result.fares[index].price;
                    done(err);
                });
        }, 10000);

        it('should request travel flow', done => {
            request(app).post('/use/functions/requestTravelFlow')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    value: value,
                    fareId: fareId,
                    destination: destiny,
                    origin: origin,
                    distance: distance,
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId).not.toBeUndefined();
                    travelId = res.body.result.objectId;
                    done(err);
                });
        }, 10000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.status).toEqual('new');
                    done(err);
                });
        }, 10000);
    });

    describe('Travel Flow', () => {

            it('should get travel by id', done => {
                setTimeout(() => {
                request(app).post('/use/functions/getTravelById')
                    .send({
                        _ApplicationId: appId,
                        _SessionToken: sessionToken,
                        objectId: travelId,
                    })
                    .end((err, res) => {
                        expect(res ? res.status : 'error').toEqual(200);
                        expect(res.body.result.status).toEqual('cancelled');
                        done(err);
                    });
            }, 5000);
        }, 10000);
    });
});

describe('Complete Travel paying with money', () => { //Catedral Nossa Senhora da Boa viagem -> Praça da Liberdade
    it('should add credit to driver', done => {
        request(app).post('/use/functions/eraseInDebt')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                driverId: userId,
                amount: creditDriver
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should get driver by id', done => {
        request(app).post('/use/functions/getDriverById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                if(config.blockDriversInDebt)
                    expect(res.body.result.user.blockedByDebt).toEqual(false);
                expect(res.body.result.user.inDebt).toEqual(- creditDriver - debtDriver);
                done(err);
            });
    }, 10000);

    describe('List Travel options', () => {

        //turn a driver available
        it('should turn a driver available', done => {
            request(app).post('/use/functions/updateBasicData')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    latitude: -19.927457,
                    longitude: -43.942367,
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
        }, 10000);

        it('should list travel options', done => {
            placeId = TravelsData.autocompletePlacesMock2();
            origin = TravelsData.getRouteMock2().origin;
            destiny = TravelsData.getRouteMock2().destiny;
            distance = TravelsData.getRouteMock2().distance;
            duration = TravelsData.getRouteMock2().duration;
            request(app).post('/use/functions/listTravelOptions')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    city: 'Belo Horizonte',
                    distance: distance,
                    location:
                        {
                            latitude: -19.9319811,
                            longitude: -43.9380019
                        },
                    offset: -180,
                    state: 'Minas Gerais',
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.fares.length > 0).toEqual(true);
                    let index = undefined;
                    for (let i = 0; i < res.body.result.fares.length; i++) {
                        if (res.body.result.fares[i].type === "Econômico") {
                            index = i;
                            break;
                        }
                    }
                    expect(res.body.result.fares[index].price).toEqual(parseFloat((8 + distance * 1.5 + duration * 10).toFixed(2)));
                    fareId = res.body.result.fares[index].objectId;
                    value = res.body.result.fares[index].price;
                    done(err);
                });
        }, 10000);

        it('should request travel flow', done => {
            request(app).post('/use/functions/requestTravelFlow')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    value: value,
                    fareId: fareId,
                    destination: destiny,
                    origin: origin,
                    distance: distance,
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId).not.toBeUndefined();
                    travelId = res.body.result.objectId;
                    done(err);
                });
        }, 10000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId,
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
                        objectId: travelId,
                        offset: -180
                    })
                    .end((err, res) => {
                        expect(res ? res.status : 'error').toEqual(200);
                        done(err);
                    });
            }, 5000);
        }, 90000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.status).toEqual('onTheWay');
                    done(err);
                });
        }, 100000);

        //informar chegada
        it('should inform arrival', done => {
            request(app).post('/use/functions/informArrival')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    objectId: travelId,
                    offset: -180
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result).toEqual("onTheWay");
                    done(err);
                });
        }, 100000);

        it('should init travel', done => {
            request(app).post('/use/functions/initTravel')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    objectId: travelId,
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
                    _SessionToken: sessionToken,
                    objectId: travelId,
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
                    objectId: travelId,
                    offset: -180,
                    latitude: -19.9319811,
                    longitude: -43.9380019
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.valueDriver).not.toBeUndefined();
                    valueDriver = res.body.result.valueDriver;
                    done(err);
                });
        }, 100000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId,
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
                    _SessionToken: sessionToken,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.totalTravels).toEqual(2);
                    expect(res.body.result.travels[0].objectId).toEqual(travelId);
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
                    expect(res.body.result.travels[0].objectId).toEqual(travelId);
                    expect(res.body.result.travels[0].status).toEqual("completed");
                    done(err);
                });
        }, 10000);

        it('should get driver by id', done => {
            request(app).post('/use/functions/getDriverById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenAdmin,
                    userId: userId
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.user.inDebt).toEqual(- creditDriver - debtDriver + 1);
                    done(err);
                });
        }, 10000);
    });
});

//Teste com motorista sem crédito
describe('First Steps', () => {
    it('should accept register a passenger', done => {
        request(app).post('/use/functions/signUpPassenger')
            .send(passenger2[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId !== undefined).toEqual(true);
                expect(res.body.result.sessionToken !== undefined).toEqual(true);
                done(err);
            });
    }, 50000);

    it('should accept login with the registered passenger', done => {
        request(app).post('/use/functions/logInPassenger')
            .send(passengerLogin2)
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId !== undefined).toEqual(true);
                expect(res.body.result.sessionToken !== undefined).toEqual(true);
                idPassenger = res.body.result.objectId;
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    }, 50000);
});

describe('Create Driver', () => {

    it('should accept register a driver', done => {
        request(app).post('/use/functions/signUpDriver')
            .send(driver2[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                sessionTokenDriver = res.body.result.sessionToken;
                userId = res.body.result.objectId;
                done(err);
            });
    }, 10000);

    it('should validate the code', done => {
        request(app).post('/use/functions/validateCode')
            .send({
                _ApplicationId: appId,
                code: '3691',
                _SessionToken: sessionTokenDriver
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should accept legal consent', done => {
        request(app).post('/use/functions/signLegalConsent')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should accept complete driver profile', done => {
        request(app).post('/use/functions/completeProfile')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                name: driver2[0].name,
                lastName: driver2[0].name,
                birthDate: "12/08/93",
                city: "Belo Horizonte"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

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

    it('should add category to vehicle', done => {
        request(app).post('/use/functions/addCategoryToVehicle')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                catId: catId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should update the vehicle data', done => {
        request(app).post('/use/functions/updateVehicleData')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                model: "CG",
                year: "2018",
                color: "vermelho",
                plate: "HJGW1234",
                brand: "test"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should create a document', done => {
        request(app).post('/use/functions/createDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "CPF",
                description: "CADASTRO DE PESSOA FÍSICA",
                required: true,
                link: "Link com a descrição das instruções de como tirar a foto do documento..."
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    //Lista documentos ainda não enviados
    it('should list documents the driver need to send', done => {
        request(app).post('/use/functions/listDocsSent')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                docs = res.body.result;
                done(err);
            });
    }, 10000);

    it('should update the incomplete user data', done => {
        for (let i in docs) {
            docId = docs[i].objectId;
            request(app).post('/use/functions/createUserDoc')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    docId: docId,
                    link: "link que representa a foto do meu documento .png"
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    done(err);
                });
        }
    }, 10000);

    it('should get driver by id', done => {
        request(app).post('/use/functions/getDriverById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should approve user document', done => {
        request(app).post('/use/functions/approveUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should create bank account ', done => {
        request(app).post('/use/functions/createBankAccount')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver,
                account: "00010838",
                accountDigit: "3",
                agency: "2229",
                bankCode: "104",
                cpf: "125.535.276-08",
                name: "Axel",
                type: "conta_poupanca"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);
});

describe('Cancel Travel paying with money', () => { //Catedral Nossa Senhora da Boa viagem -> Praça da Liberdade
    describe('List Travel options', () => {

        //turn a driver available
        it('should turn a driver available', done => {
            request(app).post('/use/functions/updateBasicData')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    latitude: -19.927457,
                    longitude: -43.942367,
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
        }, 10000);

        it('should list travel options', done => {
            placeId = TravelsData.autocompletePlacesMock2();
            origin = TravelsData.getRouteMock2().origin;
            destiny = TravelsData.getRouteMock2().destiny;
            distance = TravelsData.getRouteMock2().distance;
            duration = TravelsData.getRouteMock2().duration;
            request(app).post('/use/functions/listTravelOptions')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    city: 'Belo Horizonte',
                    distance: distance,
                    location:
                        {
                            latitude: -19.9319811,
                            longitude: -43.9380019
                        },
                    offset: -180,
                    state: 'Minas Gerais',
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.fares.length > 0).toEqual(true);
                    let index = undefined;
                    for (let i = 0; i < res.body.result.fares.length; i++) {
                        if (res.body.result.fares[i].type === "Econômico") {
                            index = i;
                            break;
                        }
                    }
                    expect(res.body.result.fares[index].price).toEqual(parseFloat((8 + distance * 1.5 + duration * 10).toFixed(2)));
                    fareId = res.body.result.fares[index].objectId;
                    value = res.body.result.fares[index].price;
                    done(err);
                });
        }, 10000);

        it('should request travel flow', done => {
            request(app).post('/use/functions/requestTravelFlow')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    value: value,
                    fareId: fareId,
                    destination: destiny,
                    origin: origin,
                    distance: distance,
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId).not.toBeUndefined();
                    travelId = res.body.result.objectId;
                    done(err);
                });
        }, 10000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.status).toEqual('new');
                    done(err);
                });
        }, 10000);
    });

    describe('Travel Flow', () => {
        it('should get travel by id', done => {
            setTimeout(() => {
                request(app).post('/use/functions/getTravelById')
                    .send({
                        _ApplicationId: appId,
                        _SessionToken: sessionToken,
                        objectId: travelId,
                    })
                    .end((err, res) => {
                        expect(res ? res.status : 'error').toEqual(200);
                        expect(res.body.result.status).toEqual('cancelled');
                        // expect(res.body.result.cancelBy).toEqual('system');
                        expect(res.body.result.errorReason).toEqual('Não há motoristas disponíveis na região.');
                        done(err);
                    });
            }, 19000);
        }, 90000);
    });
});
