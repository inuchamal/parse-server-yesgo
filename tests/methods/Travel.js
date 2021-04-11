const {request, app} = require('../config');
const FakerUser = require('../Faker/User.js');
const FakerCard = require('../Faker/Card.js');
const {config} = require('../config');
const firebase = require('firebase');
const TravelsData = require('../Mock/TravelsData.js');
const appId = config.appId;

let sessionToken, idPassenger, distance, duration, sessionTokenAdmin, sessionTokenDriver, catId, docId,
    userDocId, userId, fareId, travelId1, travelId2, placeId, docs, value, destiny, origin, cardId,
    valueDriver, listRadius, radiusId, erro, listFares, serviceOrder, serviceOrder2;
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
                code: '3691',
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
                city: "Ouro Preto"
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
                name: "Pop",
                description: "Jet Ski",
                description_en: "Jet Ski",
                icon: "icon.png",
                percentCompany: 12,
                type: "common",
                minCapacity: 12,
                maxCapacity: 16,
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
                userDocId = res.body.result.userDocs[0].objectId;
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

describe('Dismiss Reasons', () => {
    it('Create dismiss reason', done => {
        request(app).post('/use/functions/createCancellation')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                type: "all",
                descriptions: {
                    "pt": "Quarto motivo do cancelamento desativado",
                    "es": "Cuarto motivo de cancelación",
                    "en": "Fourth reason for cancellation"},
                activated: true
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.object.objectId).not.toBeUndefined();
                expect(res.body.result.object.activated).toBeTruthy();
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
            if (listRadius[i].city === "Ouro Preto") {
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
                    city: "Ouro Preto",
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
            if (listFares[i].name === "Nova Taxa") {
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
                    name: "Nova taxa",
                    days: ["Seg", "Ter", "Qua", "Qui", "Sex"],
                    time: "00:00-23:59",
                    value: 1.4,
                    valueKm: 0.39,
                    valueTime: 3,
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
    }, 10000);
});

describe('Complete Travel paying with money', () => {
    describe('List Travel options', () => {

        //turn a driver available
        it('should turn a driver available', done => {
            request(app).post('/use/functions/updateBasicData')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    latitude: -20.400503158569336,
                    longitude: -43.511051177978516,
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
            placeId = TravelsData.autocompletePlacesMock4();
            origin = TravelsData.getRouteMock4().origin;
            destiny = TravelsData.getRouteMock4().destiny;
            distance = TravelsData.getRouteMock4().distance;
            duration = TravelsData.getRouteMock4().duration;
            request(app).post('/use/functions/listTravelOptions')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    city: 'Ouro Preto',
                    distance: distance,
                    location:
                        {
                            latitude: -20.400503158569336,
                            longitude: -43.511051177978516
                        },
                    offset: -180,
                    state: 'Minas Gerais',
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.fares[0].objectId).not.toBeUndefined();
                    expect(res.body.result.fares[0].type === "Pop").toEqual(true);
                    expect(res.body.result.fares[0].price).toEqual(parseFloat((1.4 + distance * 0.39 + duration * 3).toFixed(2)));
                    fareId = res.body.result.fares[0].objectId;
                    value = res.body.result.fares[0].price;
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
                    travelId1 = res.body.result.objectId;
                    done(err);
                });
        }, 50000);

        it('should get travel detail', done => {
            request(app).post('/use/functions/getTravelDetail')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    objectId: travelId1
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.dismissReason).not.toBeUndefined();
                    expect(res.body.result.dismissReason.length).toEqual(1);
                    done(err);
                });
        }, 50000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId1,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.serviceOrder).not.toBeUndefined();
                    serviceOrder = res.body.result.serviceOrder;
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
                    _SessionToken: sessionToken,
                    objectId: travelId1,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.serviceOrder).toEqual(serviceOrder);
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
                    objectId: travelId1,
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
                    _SessionToken: sessionToken,
                    objectId: travelId1,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.serviceOrder).toEqual(serviceOrder);
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
                    latitude: -20.3957722,
                    longitude: -43.5078521

                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    //expect(res.body.result.valueDriver).toEqual(1.86);
                    valueDriver = res.body.result.valueDriver;
                    done(err);
                });
        }, 100000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId1,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.serviceOrder).toEqual(serviceOrder);
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
                    expect(res.body.result.travels[0].serviceOrder).toEqual(serviceOrder);
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
                    if(!config.usePlan)
                        expect(res.body.result.user.inDebt).toEqual(parseFloat((valueDriver * 0.12).toFixed(2)));
                    done(err);
                });
        }, 10000);
    });
});

describe('Consult firebase', () => {
    it('Check phone numbers', done => {
        return firebase.database().ref("travels/" + travelId1 + "/").once("value").then(function (snapshot) {
            let travel = snapshot.val();
            let clientNumber = travel.client.phone || "";
            expect(clientNumber.charAt(0)).toEqual("0");
            if (travel.driver) {
                let driverNumber = travel.driver.phone || "";
                expect(driverNumber.charAt(0)).toEqual("0");
            }
            done();
        });
    }, 10000);

    it('should check if there is a serviceOrder in firebase', done => {
        return firebase.database().ref("travels/" + travelId1 + "/").once("value").then(function (snapshot) {
            let travel = snapshot.val();
            expect(travel.serviceOrder).not.toBeUndefined();
            done();
        });
    }, 10000);
});

describe('Complete Travel paying with card', () => {
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
    }, 10000);

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
    }, 10000);

    describe('Get a route', () => {
        it('should autocomplete string to search places', done => {
            request(app).post('/use/functions/autocompletePlaces')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    text: "Praça Vereador Jorge Pedroso"
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.predictions.length > 0).toEqual(true);
                    //expect(res.body.result.predictions[0].place_id === "ChIJo4ox1pIKpAARdQ2IsqNjuUo").toEqual(true);
                    placeId = "ChIJo4ox1pIKpAARdQ2IsqNjuUo";
                    done(err);
                });
        }, 10000);

        it('should get route', done => {
            request(app).post('/use/functions/getRoute')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    destinyPlaceId: placeId,
                    originLat: -20.4005033,
                    originLng: -43.511050999999995
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.origin).not.toBeUndefined();
                    expect(res.body.result.destiny).not.toBeUndefined();
                    expect(res.body.result.distance >= (451 - 451 * 0.2) || res.body.result.distance <= (451 + 451 * 0.2)).toEqual(true);
                    expect(res.body.result.duration >= (129 - 129 * 0.2) || res.body.result.duration <= (129 + 129 * 0.2)).toEqual(true);

                    origin = res.body.result.origin.info;
                    destiny = res.body.result.destiny.info;
                    distance = res.body.result.distance;
                    duration = res.body.result.duration;
                    done(err);
                });
        }, 10000);
    });

    describe('List Travel options', () => {

        //turn a driver available
        it('should turn a driver available', done => {
            request(app).post('/use/functions/updateBasicData')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    latitude: -20.400503158569336,
                    longitude: -43.511051177978516,
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
            request(app).post('/use/functions/listTravelOptions')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    city: 'Ouro Preto',
                    distance: distance,
                    location:
                        {
                            latitude: -20.400503158569336,
                            longitude: -43.511051177978516
                        },
                    offset: -180,
                    state: 'Minas Gerais',
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.fares[0].objectId).not.toBeUndefined();
                    expect(res.body.result.fares[0].type === "Pop").toEqual(true);
                    expect(res.body.result.fares[0].price).toEqual(parseFloat((1.4 + distance * 0.39 + duration * 3).toFixed(2)));
                    fareId = res.body.result.fares[0].objectId;
                    value = res.body.result.fares[0].price;
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
                    time: duration,
                    cardId: cardId
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId).not.toBeUndefined();
                    travelId2 = res.body.result.objectId;
                    done(err);
                });
        }, 10000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId2,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.serviceOrder).not.toBeUndefined();
                    serviceOrder2 = res.body.result.serviceOrder;
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
                        objectId: travelId2,
                        offset: -180
                    })
                    .end((err, res) => {
                        expect(res ? res.status : 'error').toEqual(200);
                        done(err);
                    });
            }, 9000);
        }, 100000);

        it('should get travel by id', done => {
            request(app).post('/use/functions/getTravelById')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    objectId: travelId2,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.serviceOrder).toEqual(serviceOrder2);
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
                    objectId: travelId2,
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
                    objectId: travelId2,
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
                    objectId: travelId2,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.serviceOrder).toEqual(serviceOrder2);
                    expect(res.body.result.status).toEqual('onTheDestination');
                    done(err);
                });
        }, 10000);

        it('should complete travel', done => {
            request(app).post('/use/functions/completeTravel')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    objectId: travelId2,
                    offset: -180,
                    latitude: -20.4026717,
                    longitude: -43.5107256
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
                    objectId: travelId2,
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.serviceOrder).toEqual(serviceOrder2);
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
                    expect(res.body.result.travels[0].objectId).toEqual(travelId2);
                    expect(res.body.result.travels[0].status).toEqual("completed");
                    expect(res.body.result.travels[0].serviceOrder).toEqual(serviceOrder2);
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
                    expect(res.body.result.totalTravels).toEqual(2);
                    expect(res.body.result.travels[0].objectId).toEqual(travelId2);
                    expect(res.body.result.travels[0].status).toEqual("completed");
                    expect(res.body.result.travels[0].serviceOrder).toEqual(serviceOrder2);
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
                    expect(res.body.result.user.inDebt).toEqual(0);
                    done(err);
                });
        }, 10000);
    });
});

describe('Delete Travel payed with money', () => {
    it('should get driver by id', done => {
        request(app).post('/use/functions/getDriverById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.user.inDebt).toEqual(0);
                done(err);
            });
    }, 10000);

    it('should delete travel', done => {
        request(app).post('/use/functions/deleteTravel')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                travelId: travelId1,
                offset: -180
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result).toEqual('O objeto foi removido com sucesso');
                done(err);
            });
    }, 10000);

    it('should get travel by id', done => {
        request(app).post('/use/functions/getTravelById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                objectId: travelId1,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.status).toEqual('deleted');
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
                if(!config.usePlan)
                    expect(res.body.result.user.inDebt).toEqual(parseFloat((0 - valueDriver * 0.12).toFixed(2)));
                done(err);
            });
    }, 10000);
});

describe('Delete Travel payed with card', () => {
    it('should get driver by id', done => {
        request(app).post('/use/functions/getDriverById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                if(!config.usePlan)
                    expect(res.body.result.user.inDebt).toEqual(parseFloat((0 - valueDriver * 0.12).toFixed(2)));
                done(err);
            });
    }, 10000);

    it('should delete travel', done => {
        request(app).post('/use/functions/deleteTravel')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                travelId: travelId2,
                offset: -180
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result).toEqual('O objeto foi removido com sucesso');
                done(err);
            });
    }, 10000);

    it('should get travel by id', done => {
        request(app).post('/use/functions/getTravelById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                objectId: travelId2,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.status).toEqual('deleted');
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
                if(!config.usePlan)
                    expect(res.body.result.user.inDebt).toEqual(parseFloat((0 - valueDriver * 0.12).toFixed(2)));
                done(err);
            });
    }, 10000);
});
