const {request, app} = require('../config');
const Faker = require('../Faker/User.js');
const {config} = require('../config');
const Define = require('../../lib/Define.js');
const appId = config.appId;

let amountDrivers = 2;
let sessionToken, catId, docId, userDocId, userId, installationId, sessionTokenAdmin;

let drivers1 = Faker.createDrivers(amountDrivers);
let drivers2 = Faker.createDrivers(amountDrivers);
let drivers3 = Faker.createDrivers(amountDrivers);
let drivers4 = Faker.createDrivers(amountDrivers);

installationId = drivers1[0].installationId;

let driver1 = {
    _ApplicationId: drivers1[0]._ApplicationId,
    login: drivers1[0].email,
    password: drivers1[0].password
};

describe('Register Driver', () => {
    it('should accept register all this drivers', done => {
        for (let i = 0; i < amountDrivers; i++) {
            request(app).post('/use/functions/signUpDriver')
                .send(drivers1[i])
                .end((err, res) => {
                    expect(res ? res.status : 'error' ).toEqual(200);
                    done(err);
                });
        }
    }, 10000);

    it('should not accept register all this drivers because of no specific gender', done => {
        for (let i = 0; i < amountDrivers; i++) {
            drivers2[i].gender = "NA";
            request(app).post('/use/functions/signUpDriver')
                .send(drivers2[i])
                .end((err, res) => {
                    expect(res.status).toEqual(400);
                    done(err);
                });
        }
    }, 10000);

    it('should not accept register all this drivers because of null email', done => {
        for (let i = 0; i < amountDrivers; i++) {
            drivers3[i].email = null;
            request(app).post('/use/functions/signUpDriver')
                .send(drivers3[i])
                .end((err, res) => {
                    expect(res.status).toEqual(400);
                    done(err);
                });
        }
    }, 10000);

    it('should not accept register all this passengers because of invalid cpf', done => {
        for (let i = 0; i < amountDrivers; i++) {
            drivers4[i].cpf = '123';
            request(app).post('/use/functions/signUpDriver')
                .send(drivers4[i])
                .end((err, res) => {
                    expect(res.status).toEqual(400);
                    done(err);
                });
        }
    }, 10000);
});

describe('Login Driver', () => {
    it('Should accept login by driver', done => {
        request(app).post('/use/functions/logInDriver')
            .send(driver1)
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.profileStage).toEqual("phoneValidation");
                sessionToken = res.body.result.sessionToken;
                userId = res.body.result.objectId;
                done(err);
            });
    }, 10000);

    it('should not login by passenger because of there is no register', done => {
        request(app).post('/use/functions/logInDriver')
            .send({
                _ApplicationId: appId,
                login: 'mariazinha@gmail.com',
                password: "123456"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 10000);

    it('should not login by passenger because of invalid email', done => {
        request(app).post('/use/functions/logInDriver')
            .send({
                _ApplicationId: appId,
                login: 'mariazinha',
                password: "123456"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 10000);
});

//Profile Stage: 1 -> 2
describe('Validation code', () => {
    it('should validate the code', done => {
        request(app).post('/use/functions/validateCode')
            .send({
                _ApplicationId: appId,
                code: '3691',
                _SessionToken: sessionToken
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should login by driver', done => {
        request(app).post('/use/functions/logInDriver')
            .send(driver1)
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.profileStage).toEqual(Define.profileStage["2"]);
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    }, 10000);
});

//Profile Stage: 2 -> 3
describe('Sign Legal Consent', () => {
    it('should accept legal consent', done => {
        request(app).post('/use/functions/signLegalConsent')
            .send({
                _ApplicationId: appId,
                code: '3691',
                _SessionToken: sessionToken
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should login by driver', done => {
        request(app).post('/use/functions/logInDriver')
            .send(driver1)
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.profileStage).toEqual(Define.profileStage["3"]);
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    }, 10000);
});

//Profile Stage: 3 -> 4
describe('Complete the profile', () => {
    it('should accept complete driver profile', done => {
        request(app).post('/use/functions/completeProfile')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                name: drivers1[0].name,
                birthDate: "12/08/93",
                city: "Ouro Preto"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should not accept complete driver profile because the birthDate is invalid', done => {
        request(app).post('/use/functions/completeProfile')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                name: drivers1[0].name,
                birthDate: "14",
                city: "Ouro Preto"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 10000);

    it('should not accept complete driver profile because there is not city', done => {
        request(app).post('/use/functions/completeProfile')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                name: drivers1[0].name,
                birthDate: "12/08/93"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 10000);

    it('should login by driver', done => {
        request(app).post('/use/functions/logInDriver')
            .send(driver1)
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.profileStage).toEqual(Define.profileStage["4"]);
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    });
});

describe('Create category with admin', () => {
    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            sessionTokenAdmin = res.body.result.sessionToken;
            done(err);
        });
    }, 10000);

    it('should create a category', done => {
        request(app).post('/use/functions/createCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "Barco",
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
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should create a category', done => {
        request(app).post('/use/functions/createCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "Barco",
                description: "Jet Ski",
                icon: "icon.png",
                percentCompany: 12,
                type: "common",
                minCapacity: 12,
                maxCapacity: 16,
                active: true,
                year: "2008"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(400);
                done(err);
            });
    }, 10000);

    it('should list actived categories' , done => {
        request(app).post('/use/functions/listCategories')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                catId = res.body.result[0].objectId;
                done(err);
            });
    }, 10000);
});

//Profile Stage: 4 -> 5
describe('Add category', () => {
    it('should add category to vehicle', done => {
        request(app).post('/use/functions/addCategoryToVehicle')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                catId: catId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should login by driver', done => {
        request(app).post('/use/functions/logInDriver')
            .send(driver1)
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.profileStage).toEqual(Define.profileStage["5"]);
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    });
});

//Profile Stage: 5 -> 6
describe('Vehicle Data', () => {
    it('should not update the vehicle data because plate is invalid', done => {
        request(app).post('/use/functions/updateVehicleData')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                model: "Civic",
                year: "2017",
                color: "black",
                plate: "HBJ-1864",
                brand: "Honda"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 10000);

    it('should update the vehicle data', done => {
        request(app).post('/use/functions/updateVehicleData')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                model: "CG",
                year: "2018",
                color: "vermelho",
                plate: "HJGW1234",
                brand: "test"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should login by driver', done => {
        request(app).post('/use/functions/logInDriver')
            .send(driver1)
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.profileStage).toEqual(Define.profileStage["6"]);
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    });
});

describe('Create document with admin', () => {
    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            sessionTokenAdmin = res.body.result.sessionToken;
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
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    //Lista documentos ainda não enviados
    it('should list documents the driver need to send', done => {
        request(app).post('/use/functions/listDocsSent')
            .send({_ApplicationId: appId,
                _SessionToken: sessionToken})
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.length).toEqual(1);
                docId = res.body.result[0].objectId;
                done(err);
            });
    }, 10000);
});

//Profile Stage: 6 -> 7
describe('Complete Documents', () => {

    it('should not update the incomplete user data because the docId is invalid', done => {
        request(app).post('/use/functions/createUserDoc')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                docId: "123",
                link: "link que representa a foto do meu documento .png"
            })
            .end((err, res) => {
                expect(res.status).toEqual(404);
                done(err);
            });
    }, 10000);

    it('should update the incomplete user data', done => {
        request(app).post('/use/functions/createUserDoc')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                docId: docId,
                link: "link que representa a foto do meu documento .png"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should update the incomplete user data again', done => {
        request(app).post('/use/functions/createUserDoc')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                docId: docId,
                link: "link que representa a foto do meu documento .png"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should login by driver', done => {
        request(app).post('/use/functions/logInDriver')
            .send(driver1)
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.profileStage).toEqual(Define.profileStage["7"]);
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    });

    //Lista documentos ainda não enviados e documentos que já foram enviados com status de enviado
    it('should list documents the driver need to send', done => {
        request(app).post('/use/functions/listDocsSent')
            .send({_ApplicationId: appId,
                _SessionToken: sessionToken})
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.length).toEqual(1);
                expect(res.body.result[0].status).toEqual("sent");
                docId = res.body.result[0].objectId;
                done(err);
            });
    }, 10000);
});

// //Profile Stage: 7 -> 8
describe('Approve send user documents', () => {
    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            sessionTokenAdmin = res.body.result.sessionToken;
            done(err);
        });
    }, 10000);

    it('should not approve send user documents because docId is invalid', done => {
        request(app).post('/use/functions/approveUserDoc')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                docId: "123",
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 10000);

    it('should not approve send user documents because the user is not a admin', done => {
        request(app).post('/use/functions/approveUserDoc')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                docId: userId,
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 10000);

    it('should get driver by id' , done => {
        request(app).post('/use/functions/getDriverById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                userId: userId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                userDocId = res.body.result.userDocs[0].objectId;
                done(err);
            });
    }, 10000);

    it('should reject user document', done => {
        request(app).post('/use/functions/rejectUserDoc')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                docId: userDocId,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should edit user document with admin', done => {
        request(app).post('/use/functions/sendUserDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                documentId: userDocId,
                link: "Atualização do documento do motorista pela pelo administrador"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should approve user document', done => {
        request(app).post('/use/functions/approveUserDoc')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                docId: userDocId,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should get user doc by id', done => {
        request(app).post('/use/functions/getUserDocById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                docId: userDocId,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.status).toEqual('approved');
                done(err);
            });
    }, 10000);

    it('should login by driver', done => {
        request(app).post('/use/functions/logInDriver')
            .send(driver1)
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.profileStage).toEqual(Define.profileStage["8"]);
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    });

    //Lista documentos ainda não enviados e documentos que já foram enviados com status de aprovado
    it('should list documents the driver need to send', done => {
        request(app).post('/use/functions/listDocsSent')
            .send({_ApplicationId: appId,
                _SessionToken: sessionToken})
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.length).toEqual(1);
                expect(res.body.result[0].status).toEqual("approved");
                docId = res.body.result[0].objectId;
                done(err);
            });
    }, 10000);
});

describe('Profile', () => {
    it('should show user profile', done => {
        request(app).post('/use/functions/userProfile')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);
});

describe('Women Filter', () => {
    it('should on women only filter', done => {
        request(app).post('/use/functions/onWomenOnlyFilter')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId
            })
            .end((err, res) => {
                if (drivers1[0].gender === 'f') {
                    expect(res ? res.status : 'error' ).toEqual(200);
                } else {
                    expect(res.status).toEqual(400);
                }
                done(err);
            });
    }, 10000);

    it('should on women only filter', done => {
        request(app).post('/use/functions/offWomenOnlyFilter')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId
            })
            .end((err, res) => {
                if (drivers1[0].gender === 'f') {
                    expect(res ? res.status : 'error' ).toEqual(200);
                } else {
                    expect(res.status).toEqual(400);
                }
                done(err);
            });
    }, 10000);
});

describe('Set status', () => {
    it('should accept setting online', done => {
        request(app).post('/use/functions/setOnline')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                offset: -180
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should accept setting offline', done => {
        request(app).post('/use/functions/setOffline')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                offset: -180
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should not accept setting online', done => {
        request(app).post('/use/functions/setOnline')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 10000);
});

describe('Logout Driver', () => {
    it('Should accept logout by driver', done => {
        request(app).post('/use/functions/logout')
            .send({
                installationId: installationId,
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                offset: -180
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);
});

describe('CRUD Document', () => {
    it('should create a document', done => {
        request(app).post('/use/functions/createDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "RG",
                description: "Registro Geral",
                required: true,
                link: "Link com a descrição das instruções de como tirar a foto do documento..."
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should create a document', done => {
        request(app).post('/use/functions/createDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "Documento com frente e verso",
                description: "Registro Geral",
                required: false,
                link: "Link com a descrição das instruções de como tirar a foto do documento...",
                hasBack: true
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(400);
                done(err);
            });
    }, 10000);

    //Lista documentos ainda não enviados
    it('should list documents the driver need to send', done => {
        request(app).post('/use/functions/listDocsSent')
            .send({_ApplicationId: appId,
                _SessionToken: sessionToken})
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.length).toEqual(2);
                docId = res.body.result[0].objectId;
                done(err);
            });
    }, 10000);

    it('should update a link document', done => {
        request(app).post('/use/functions/addLinkToDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                docId: docId,
                link: "Atualização de link com a descrição das instruções de como tirar a foto do documento..."
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    it('should update another document field', done => {
        request(app).post('/use/functions/updateDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                name: "Registro - Geral",
                docId: docId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);
});


