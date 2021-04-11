const {request, app, config} = require('../../config');
const FakerUser = require('../../Faker/User.js');
const FakerCard = require('../../Faker/Card.js');
/*
const req = require('sync-request');
let config = req('GET', 'http://god-api.usemobile.com.br/test');
config = JSON.parse(config.getBody("utf-8"));
*/

const appId = config.appId;
const hasCancellation = config.hasCancellation || false;

let sessionToken, idPassenger, distance, duration, sessionTokenAdmin, sessionTokenDriver, catId, docId, listFares,
    userDocId, userId, fareId, travelId, placeId, docs, value, destiny, origin, cardId, listRadius, radiusId, erro;
let passenger = FakerUser.createPassengers(1);
let driver = FakerUser.createDrivers(1);
let minValue = 5;

let passengerLogin = {
    _ApplicationId: appId,
    login: passenger[0].email,
    password: passenger[0].password
};

describe('First Steps', () => {
    it('should accept register a passenger', done => {
        request(app).post('/use/functions/signUpPassenger')
            .send(passenger[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();

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
                idPassenger = res.body.result.objectId;
                sessionToken = res.body.result.sessionToken;

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
                city: "Mariana"
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
                name: "Lotação",
                description: "Carro bem topinho",
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

    it('should list radius', done => {
        request(app).post('/use/functions/listRadius')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                listRadius = res.body.result.radius;
                done(err);
            });
    }, 50000);

    it('should create radius', done => {
        for (let i = 0; i < listRadius.length; i++) {
            if (listRadius[i].city === "Mariana") {
                radiusId = listRadius[i].objectId;
                break;
            }
        }
        if (!radiusId) {
            request(app).post('/use/functions/createRadius')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenAdmin,
                    distance: "9000000",
                    city: "Mariana",
                    state: "Minas Gerais"
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId).not.toBeUndefined();
                    expect(res.body.result.message).toEqual("O objeto foi criado com sucesso");
                    erro = err;

                });
        }
        done(erro);
    }, 50000);

    it('should list fares', done => {
        request(app).post('/use/functions/listFares')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                listFares = res.body.result.fares;
                done(err);
            });
    }, 50000);

    it('should create fare', done => {
        for (let i = 0; i < listFares.length; i++) {
            if (listFares[i].name === "Corrida de lotação") {
                fareId = listFares[i].objectId;
                minValue = listFares[i].minValue;
                break;
            }
        }
        if (!fareId) {
            request(app).post('/use/functions/createFare')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenAdmin,
                    catId: catId,
                    name: "Corrida de lotação",
                    days: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab"],
                    time: "00:00-23:59",
                    value: 8,
                    valueKm: 2.3,
                    valueTime: 9,
                    additionalFee: 0,
                    active: true,
                    minValue: minValue
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId).not.toBeUndefined();
                    expect(res.body.result.message).toEqual("O objeto foi criado com sucesso");
                    erro = err;
                });
        }
        done(erro);
    }, 50000);
});

describe('Cancel Travel with passenger when travel status is on the way (onTheWay)', () => {
    it('should create cards', done => {
        let card = FakerCard.createCard1();
        card._SessionToken = sessionToken;
        request(app).post('/use/functions/createCard')
            .send(card)
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                cardId = res.body.result.objectId;
                done(err);
            });
    }, 50000);

    it('should set primary card', done => {
        request(app).post('/use/functions/setPrimaryCard')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                objectId: cardId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 50000);

    describe('Get a route', () => {
        it('should autocomplete string to search places', done => {
            request(app).post('/use/functions/autocompletePlaces')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    text: "Prefeitura de Mariana"
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.predictions.length > 0).toEqual(true);
                    //expect(res.body.result.predictions[0].place_id === "ChIJF_n3yPdzpAARAWIsjUmENM8").toEqual(true);
                    placeId = "ChIJF_n3yPdzpAARAWIsjUmENM8";
                    done(err);
                });
        }, 50000);

        it('should get route', done => {
            request(app).post('/use/functions/getRoute')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    destinyPlaceId: placeId,
                    originLat: -20.362662,
                    originLng: -43.414895
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.origin).not.toBeUndefined();
                    expect(res.body.result.destiny).not.toBeUndefined();
                    expect(res.body.result.distance >= (1430 - 1430 * 0.2) || res.body.result.distance <= (1430 + 1430 * 0.2)).toEqual(true);
                    expect(res.body.result.duration >= (310 - 310 * 0.2) || res.body.result.duration <= (310 + 310 * 0.2)).toEqual(true);

                    origin = res.body.result.origin.info;
                    destiny = res.body.result.destiny.info;
                    distance = res.body.result.distance;
                    duration = res.body.result.duration;
                    done(err);
                });
        }, 50000);
    });

    describe('List Travel options', () => {
        //turn a driver available
        it('should turn a driver available', done => {
            request(app).post('/use/functions/updateBasicData')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    latitude: -20.374998,
                    longitude: -43.416430,
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
        }, 50000);

        it('should list travel options', done => {
            request(app).post('/use/functions/listTravelOptions')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    city: 'Mariana',
                    distance: distance,
                    location:
                        {
                            latitude: -20.362702,
                            longitude: -43.414852
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
                        if (res.body.result.fares[i].type === "Lotação") {
                            index = i;
                            break;
                        }
                    }
                    expect(res.body.result.fares[index].price).toEqual(8 + distance * 2.3 + duration * 9);
                    fareId = res.body.result.fares[index].objectId;
                    value = res.body.result.fares[index].price;
                    done(err);
                });
        }, 50000);

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
                    time: duration,
                    cardId: cardId
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId).not.toBeUndefined();
                    travelId = res.body.result.objectId;
                    done(err);
                });
        }, 50000);

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
            }, 10000);
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
                    expect(res.body.result.status).toEqual('onTheWay');
                    done(err);
                });
        }, 10000);
    });

    describe('Cancel Travel', () => {
        it('should cancel travel', done => {
            request(app).post('/use/functions/cancelWithCharge')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId,
                    offset: -180
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    done(err);
                });
        }, 100000);

        it('should not cancel travel because it is already canceled', done => {
            request(app).post('/use/functions/cancelWithCharge')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId,
                    offset: -180
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(400);
                    expect(res.body.error).toEqual('Esta corrida já foi cancelada anteriormente.');
                    done(err);
                });
        }, 10000);
    });
});

describe('Cannot cancel Travel with passenger because travel is in progress (onTheDestination)', () => {
    describe('Get a route', () => {
        it('should autocomplete string to search places', done => {
            request(app).post('/use/functions/autocompletePlaces')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    text: "Praça Gomes Freire Mariana"
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.predictions.length > 0).toEqual(true);
                    //expect(res.body.result.predictions[0].place_id === "ChIJveyURA90pAARGTR_DkNfWeM").toEqual(true);
                    placeId = "ChIJveyURA90pAARGTR_DkNfWeM";
                    done(err);
                });
        }, 50000);

        it('should get route', done => {
            request(app).post('/use/functions/getRoute')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    destinyPlaceId: placeId,
                    originLat: -20.362662,
                    originLng: -43.414895
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.origin).not.toBeUndefined();
                    expect(res.body.result.destiny).not.toBeUndefined();
                    expect(res.body.result.distance >= (2494 - 2494 * 0.2) || res.body.result.distance <= (2494 + 2494 * 0.2)).toEqual(true);
                    expect(res.body.result.duration >= (523 - 523 * 0.2) || res.body.result.duration <= (523 + 523 * 0.2)).toEqual(true);

                    origin = res.body.result.origin.info;
                    destiny = res.body.result.destiny.info;
                    distance = res.body.result.distance;
                    duration = res.body.result.duration;
                    done(err);
                });
        }, 50000);
    });

    describe('List Travel options', () => {
        //turn a driver available
        it('should turn a driver available', done => {
            request(app).post('/use/functions/updateBasicData')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    latitude: -20.374998,
                    longitude: -43.416430,
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
        }, 50000);

        it('should list travel options', done => {
            request(app).post('/use/functions/listTravelOptions')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    city: 'Mariana',
                    distance: distance,
                    location:
                        {
                            latitude: -20.362702,
                            longitude: -43.414852
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
                        if (res.body.result.fares[i].type === "Lotação") {
                            index = i;
                            break;
                        }
                    }
                    expect(res.body.result.fares[index].price).toEqual(8 + distance * 2.3 + duration * 9);
                    fareId = res.body.result.fares[index].objectId;
                    value = res.body.result.fares[index].price;
                    done(err);
                });
        }, 50000);

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
                    time: duration,
                    cardId: cardId
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId).not.toBeUndefined();
                    travelId = res.body.result.objectId;
                    done(err);
                });
        }, 50000);

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
            }, 10000);
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
        }, 10000);

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
        }, 10000);

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
                    expect(res.body.result.status).toEqual('onTheDestination');
                    done(err);
                });
        }, 10000);
    });

    describe('Try to Cancel Travel', () => {
        it('should not cancel travel', done => {
            request(app).post('/use/functions/cancelWithCharge')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId,
                    offset: -180
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(400);
                    expect(res.body.error).toEqual('Não é possível cancelar uma ocorrida em andamento.');
                    done(err);
                });
        }, 10000);
    });
});

describe('Cannot cancel Travel with passenger because travel is completed (completed)', () => {
    describe('Complete travel', () => {
        it('should complete travel', done => {
            request(app).post('/use/functions/completeTravel')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    objectId: travelId,
                    offset: -180,
                    latitude: -20.375078,
                    longitude: -43.416058
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
                    expect(res.body.result.status).toEqual('completed');
                    done(err);
                });
        }, 10000);
    });

    describe('Try to Cancel Travel', () => {
        it('should not cancel travel', done => {
            request(app).post('/use/functions/cancelWithCharge')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId,
                    offset: -180
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(400);
                    expect(res.body.error).toEqual('Esta corrida já foi concluida anteriormente.');
                    done(err);
                });
        }, 10000);
    });
});

// describe('Cancel Travel with passenger when driver is on the way (waiting)', () => {
//     describe('Get a route', () => {
//         it('should autocomplete string to search places', done => {
//             request(app).post('/use/functions/autocompletePlaces')
//                 .send({
//                     _ApplicationId: appId,
//                     _SessionToken: sessionToken,
//                    text: "Rua dos Salgueiros, 369, Mariana"
//                 })
//                 .end((err, res) => {
//                     expect(res ? res.status : 'error').toEqual(200);
//                     expect(res.body.result.predictions.length > 0).toEqual(true);
//                     //expect(res.body.result.predictions[0].place_id === "ChIJ4YF8Eu5zpAAR7L99woZrMlo").toEqual(true);
//                     placeId = "ChIJ4YF8Eu5zpAAR7L99woZrMlo";
//                     done(err);
//                 });
//         }, 50000);
//
//         it('should get route', done => {
//             request(app).post('/use/functions/getRoute')
//                 .send({
//                     _ApplicationId: appId,
//                     _SessionToken: sessionToken,
//                     destinyPlaceId: placeId,
//                     originLat: -20.362662,
//                     originLng: -43.414895
//                 })
//                 .end((err, res) => {
//                     expect(res ? res.status : 'error').toEqual(200);
//                     expect(res.body.result.origin).not.toBeUndefined();
//                     expect(res.body.result.destiny).not.toBeUndefined();
//                     expect(res.body.result.distance >= (727 - 727 * 0.2) || res.body.result.distance <= (727 + 727 * 0.2)).toEqual(true);
//                     expect(res.body.result.duration >= (198 - 198 * 0.2) || res.body.result.duration <= (198 + 198 * 0.2)).toEqual(true);
//
//                     origin = res.body.result.origin.info;
//                     destiny = res.body.result.destiny.info;
//                     distance = res.body.result.distance;
//                     duration = res.body.result.duration;
//                     done(err);
//                 });
//         }, 50000);
//     });
//
//     describe('List Travel options', () => {
//         // //turn a driver available
//         it('should turn a driver available', done => {
//             request(app).post('/use/functions/updateBasicData')
//                 .send({
//                     _ApplicationId: appId,
//                     _SessionToken: sessionTokenDriver,
//                     latitude: -20.374998,
//                     longitude: -43.416430,
//                     offset: -180,
//                     appIdentifier: driver[0].appIdentifier,
//                     installationId: driver[0].installationId,
//                     deviceType: driver[0].deviceInfo.deviceType,
//                     deviceToken: driver[0].deviceToken
//                 })
//                 .end((err, res) => {
//                     expect(res ? res.status : 'error').toEqual(200);
//                     expect(res.body.result).toEqual("Você esta pronto para receber chamadas!");
//                     done(err);
//                 });
//         }, 50000);
//
//         it('should list travel options', done => {
//             request(app).post('/use/functions/listTravelOptions')
//                 .send({
//                     _ApplicationId: appId,
//                     _SessionToken: sessionToken,
//                     city: 'Mariana',
//                     distance: distance,
//                     location:
//                         {
//                             latitude: -20.362702,
//                             longitude: -43.414852
//                         },
//                     offset: -180,
//                     state: 'Minas Gerais',
//                     time: duration
//                 })
//                 .end((err, res) => {
//                    expect(res ? res.status : 'error').toEqual(200);
//                     expect(res.body.result.fares.length > 0).toEqual(true);
//                     let index = undefined;
//                     for (let i = 0; i < res.body.result.fares.length; i++) {
//                         if (res.body.result.fares[i].type === "Lotação") {
//                             index = i;
//                             break;
//                         }
//                     }
//                     expect(res.body.result.fares[index].price).toEqual(8 + distance * 2.3 + duration * 9);
//                     fareId = res.body.result.fares[index].objectId;
//                     value = res.body.result.fares[index].price;
//                     done(err);
//                 });
//         }, 50000);
//
//         it('should request travel flow', done => {
//             request(app).post('/use/functions/requestTravelFlow')
//                 .send({
//                     _ApplicationId: appId,
//                     _SessionToken: sessionToken,
//                     value: value,
//                     fareId: fareId,
//                     destination: destiny,
//                     origin: origin,
//                     distance: distance,
//                     time: duration,
//                     cardId: cardId
//                 })
//                 .end((err, res) => {
//                     expect(res ? res.status : 'error').toEqual(200);
//                     expect(res.body.result.objectId).not.toBeUndefined();
//                     travelId = res.body.result.objectId;
//                     done(err);
//                 });
//         }, 50000);
//
//         it('should get travel by id', done => {
//             request(app).post('/use/functions/getTravelById')
//                 .send({
//                     _ApplicationId: appId,
//                     _SessionToken: sessionToken,
//                     objectId: travelId,
//                 })
//                 .end((err, res) => {
//                     expect(res ? res.status : 'error').toEqual(200);
//                     expect(res.body.result.status).toEqual('new');
//                     done(err);
//                 });
//         }, 10000);
//
//     });
//
//     describe('Cancel Travel', () => {
//         it('should cancel travel', done => {
//             setTimeout(() => {
//                 request(app).post('/use/functions/cancelWithCharge')
//                     .send({
//                         _ApplicationId: appId,
//                         _SessionToken: sessionToken,
//                         objectId: travelId,
//                         offset: -180
//                     })
//                     .end((err, res) => {
//                         expect(res ? res.status : 'error').toEqual(200);
//                         done(err);
//                     });
//             }, 9000);
//         }, 10000);
//     });
// });
