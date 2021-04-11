const {request, app, config} = require('../../config');
const FakerUser = require('../../Faker/User.js');
const FakerCard = require('../../Faker/Card.js');
const TravelsData = require('../../Mock/TravelsData.js');


const appId = config.appId;
const recallAfterCancellation = config.recallAfterCancellation || true;

let sessionToken, idPassenger, distance, duration, sessionTokenAdmin, sessionTokenDriver, sessionTokenDriver2, catId,
    docId,
    userId, userId2, fareId, travelId, placeId, docs, value, destiny, origin, cardId, listRadius, listFares, exp,
    radiusId, erro, inDebt, clientDebt, rule, acceptedDate, createdAt, currentDate, status, time, splitCreatedAt,
    result, regCurrentDate, regAcceptedDate, regStatus, regDuration, regArrival, regCreatedAt, tTime, TcreatedAt;

let minValue = 6;
let passenger = FakerUser.createPassengers(1);
let driver = FakerUser.createDrivers(2);

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
                name: "Passeio turístico",
                description: "Carro normalzinho",
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

describe('Create Driver 2', () => {

    it('should accept register a driver', done => {
        request(app).post('/use/functions/signUpDriver')
            .send(driver[1])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                sessionTokenDriver2 = res.body.result.sessionToken;
                userId2 = res.body.result.objectId;
                done(err);
            });
    }, 10000);

    it('should validate the code', done => {
        request(app).post('/use/functions/validateCode')
            .send({
                _ApplicationId: appId,
                code: '3691',
                _SessionToken: sessionTokenDriver2
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
                _SessionToken: sessionTokenDriver2
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
                _SessionToken: sessionTokenDriver2,
                name: driver[1].name,
                lastName: driver[1].name,
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


    it('should add category to vehicle', done => {
        request(app).post('/use/functions/addCategoryToVehicle')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenDriver2,
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
                _SessionToken: sessionTokenDriver2,
                model: "CG",
                year: "2018",
                color: "vermelho",
                plate: "HJGW1235",
                brand: "test"
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
                _SessionToken: sessionTokenDriver2
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
                    _SessionToken: sessionTokenDriver2,
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
                userId: userId2
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
                userId: userId2,
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
                _SessionToken: sessionTokenDriver2,
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
                    expect(res.body.result.objectId !== undefined).toEqual(true);
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
            if (listFares[i].name === "Taxi para Turista") {
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
                    name: "Taxi para Turista",
                    days: ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab"],
                    time: "00:00-23:59",
                    minValue: minValue,
                    value: 5,
                    valueKm: 0.98,
                    valueTime: 7,
                    additionalFee: 0,
                    active: true
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId !== undefined).toEqual(true);
                    expect(res.body.result.message).toEqual("O objeto foi criado com sucesso");
                    erro = err;
                });
        }
        done(erro);
    }, 50000);
});

//Mirante da Ufop -> Praça Tiradentes

//Cenário onde o status da viagem === 'OnTheWay'
describe('Cancel Travel with passenger (payment with money) - Rule 1', () => { //Mirante da Ufop -> Praça Tiradentes

    describe('List Travel options', () => {
        it('should turn a driver available', done => {
            request(app).post('/use/functions/updateBasicData')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver,
                    latitude: -20.390920,
                    longitude: -43.506482,
                    offset: -180,
                    appIdentifier: driver[0].appIdentifier,
                    installationId: driver[0].installationId,
                    deviceType: driver[0].deviceInfo.deviceType,
                    deviceToken: driver[0].deviceToken
                })
                .end((err, res) => {
                    console.log(driver[0])
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result).toEqual("Você esta pronto para receber chamadas!");
                    done(err);
                });
        }, 50000);

        it('should turn the driver 2 available', done => {
            request(app).post('/use/functions/updateBasicData')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver2,
                    latitude: -20.390920,
                    longitude: -43.506482,
                    offset: -180,
                    appIdentifier: driver[1].appIdentifier,
                    installationId: driver[1].installationId,
                    deviceType: driver[1].deviceInfo.deviceType,
                    deviceToken: driver[1].deviceToken
                })
                .end((err, res) => {
                    console.log(driver[1])
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result).toEqual("Você esta pronto para receber chamadas!");
                    done(err);
                });
        }, 50000);

        it('should list travel options', done => {
            placeId = TravelsData.autocompletePlacesMock();
            origin = TravelsData.getRouteMock().origin;
            destiny = TravelsData.getRouteMock().destiny;
            distance = TravelsData.getRouteMock().distance;
            duration = TravelsData.getRouteMock().duration;
            request(app).post('/use/functions/listTravelOptions')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionToken,
                    city: 'Ouro Preto',
                    distance: distance,
                    location:
                        {
                            latitude: -20.394703,
                            longitude: -43.506098
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
                        if (res.body.result.fares[i].type === "Passeio turístico") {
                            index = i;
                            break;
                        }
                    }
                    expect(res.body.result.fares[index].price).toEqual(parseFloat((5 + distance * 0.98 + duration * 7).toFixed(2)));
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
                    time: duration
                })
                .end((err, res) => {
                    expect(res ? res.status : 'error').toEqual(200);
                    expect(res.body.result.objectId !== undefined).toEqual(true);
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
            }, 8000);
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
                    _SessionToken: sessionTokenDriver,
                    objectId: travelId,
                    offset: -180,
                    reallyCanCallAgain: true
                })
                .end((err, res) => {
                    if (result) {
                        expect(res ? res.status : 'error').toEqual(200);
                    }
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
                    if (result) {
                        expect(res ? res.status : 'error').toEqual(200);
                        expect(res.body.result.payment).toEqual('Dinheiro');
                        expect(res.body.result.cancelBy).toEqual('passenger');
                        expect(res.body.result.cancellationFee).toEqual(minValue);
                    }

                    expect(res.body.result.status).toEqual('waiting');
                    done(err);
                });

        }, 10000);

        it('should accept travel flow', done => {
            request(app).post('/use/functions/acceptTravel')
                .send({
                    _ApplicationId: appId,
                    _SessionToken: sessionTokenDriver2,
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
                    expect(res.body.result.status).toEqual('onTheWay');
                    done(err);
                });
        }, 10000);

    });
});
