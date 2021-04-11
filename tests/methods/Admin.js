const {request, app} = require('../config');
const Faker = require('../Faker/User.js');
const {config} = require('../config');
const appId = config.appId;

let sessionToken, idDriver, idPassenger, docId;
let passenger = Faker.createPassengers(2);
let drivers1 = Faker.createDrivers(1);
let newDriver = Faker.createDrivers(1);
let newPassenger = Faker.createPassengers(1);


describe('Register Administrator', () => {

    // it('should accept register all this passengers', done => {
    //     request(app).post('/use/functions/signUpPassenger')
    //         .send(passenger[0])
    //         .end((err, res) => {
    //             expect(res ? res.status : 'error' ).toEqual(200);
    //             done(err);
    //         });
    //
    // }, 10000);

    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                sessionToken = res.body.result.sessionToken;
                done(err);
            });

    }, 10000);

    it('should not login because username is invalid', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });

    }, 10000);

    it('should not login because is missing the password', done => {
        request(app).post('/use/functions/logInPassenger')
            .send({
                _ApplicationId: appId,
                login: "Karla48@hotmail.com"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });

    }, 10000);

    it('should not login because email is wrong', done => {
        request(app).post('/use/functions/logInPassenger')
            .send({
                _ApplicationId: appId,
                login: "Karl@hotmail.com",
                password: "xTuMSfdLIqE9lXl"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });

    }, 10000);
});

describe('Create document', () => {

    //Função de BeforeSave não está retornando erro de campo errado
    // it('should not create a document because there is wrong field', done => {
    //     request(app).post('/use/functions/createDocument')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionToken,
    //             name: "RG",
    //             description: "Registro Geral",
    //             requisitado: false,
    //             required: true,
    //             link: "Link com a descrição das instruções de como tirar a foto do documento..."
    //         })
    //         .end((err, res) => {
    //             expect(res.status).toEqual(400);
    //             done(err);
    //         });
    // }, 10000);

    it('should create a document', done => {
        request(app).post('/use/functions/createDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
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
                _SessionToken: sessionToken,
                name: "Foto de Perfil",
                description: "Foto de Perfil",
                code: "PROFILE_PICTURE",
                required: true,
                link: "Link com a descrição das instruções de como tirar a foto do documento..."
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    // Lista documentos ainda não enviados
    it('should list documents the driver need to send', done => {
        request(app).post('/use/functions/listDocsSent')
            .send({_ApplicationId: appId,
                _SessionToken: sessionToken})
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                //expect(res.body.result.length).toEqual(3);
                docId = res.body.result[0].objectId;
                done(err);
            });
    }, 10000);

    it('should update a link document', done => {
        request(app).post('/use/functions/addLinkToDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                docId: docId,
                link: "Atualização de link com a descrição das instruções de como tirar a foto do documento..."
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
            });
    }, 10000);

    // Erro na função de Update Document
    // A função deve ser utils.getObjectById e não _super.getObjectById e ter como parâmetro o Define.Document
    // it('should update another document field', done => {
    //     request(app).post('/use/functions/updateDocument')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionToken,
    //             name: "Registro - Geral",
    //             docId: docId
    //         })
    //         .end((err, res) => {
    //             expect(res ? res.status : 'error' ).toEqual(200);
    //             done(err);
    //         });
    // }, 10000);

    // Adicionar uma função de deletar categoria! -> Adicionar o teste dessa função aqui

    it('should create a document', done => {
        request(app).post('/use/functions/createDocument')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
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

    it('should list documents the driver need to send', done => {
        request(app).post('/use/functions/listDocsSent')
            .send({_ApplicationId: appId,
                _SessionToken: sessionToken})
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                //expect(res.body.result.length).toEqual(4);
                docId = res.body.result[0].objectId;
                done(err);
            });
    }, 10000);
});

describe('Edit Driver', () => {
    it('should accept register this drivers', done => {
        request(app).post('/use/functions/signUpDriver')
            .send(drivers1[0])
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                idDriver = res.body.result.objectId;
                done(err);
            });

    }, 10000);

    it('should accept edit driver split', done => {
        request(app).post('/use/functions/editDriverSplit')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                driverId: idDriver,
                percentage: "30"
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should not accept edit driver split because there is not a percentage', done => {
        request(app).post('/use/functions/editDriverSplit')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                driverId: idDriver
            }).end((err, res) => {
            expect(res.status).toEqual(400);
            done(err);
        });
    }, 10000);

    it('should not accept remove driver split because there is no vehicle register', done => {
        request(app).post('/use/functions/removeDriverSplit')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                driverId: idDriver
            }).end((err, res) => {
            expect(res.status).toEqual(400);
            done(err);
        });
    }, 10000);

    //it('should accept remove driver split', done => {
    //     request(app).post('/use/functions/removeDriverSplit')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionToken,
    //             driverId: idDriver
    //         }).end((err, res) => {
    //         expect(res ? res.status : 'error' ).toEqual(200);
    //         done(err);
    //     });
    // }, 10000);

    it('should accept erase blocked value', done => {
        request(app).post('/use/functions/eraseBlockedValue')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                driverId: idDriver,
                amount: 100
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);


    it('should not accept erase blocked value because amount is negative', done => {
        request(app).post('/use/functions/eraseBlockedValue')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                driverId: idDriver,
                amount: -100
            }).end((err, res) => {
            expect(res.status).toEqual(400);
            done(err);
        });
    }, 10000);

    it('should accept erase in debt', done => {
        request(app).post('/use/functions/eraseInDebt')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                driverId: idDriver,
                amount: 100
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);
});

describe('Edit user', () => {
    it('should accept register all this passengers', done => {
        request(app).post('/use/functions/signUpPassenger')
            .send(passenger[0])
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                done(err);
                idPassenger = res.body.result.objectId;
            });

    }, 50000);

    it('should accept edit cpf', done => {
        request(app).post('/use/functions/editCPF')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger,
                cpf: Faker.createCPF()
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should accept edit code', done => {
        request(app).post('/use/functions/editCode')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger,
                code: Faker.createCode()
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should accept edit an user', done => {
        request(app).post('/use/functions/editUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger,
                code: Faker.createCode(),
                name: newPassenger[0].name,
                profileImage: newPassenger[0].profileImage,
                birthDate: newPassenger[0].birthDate,
                gender: newPassenger[0].gender,
                phone: newPassenger[0].phone,
                password: newPassenger[0].password,
                city: "Ouro Preto",
                state: "Minas Gerais"

            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should not accept edit an user', done => {
        request(app).post('/use/functions/editUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger,
                cpf: "123456"
            }).end((err, res) => {
            expect(res.status).toEqual(400);
            done(err);
        });
    }, 10000);

    it('should not accept edit an user', done => {
        request(app).post('/use/functions/editUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res.status).toEqual(400);
            done(err);
        });
    }, 10000);

});

describe('List Users', () => {

    it('should search users', done => {
        request(app).post('/use/functions/searchUsers')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                email: passenger[0].email,
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list users with filter', done => {
        request(app).post('/use/functions/listUsers')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should get user by id', done => {
        request(app).post('/use/functions/getUserById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list all users', done => {
        request(app).post('/use/functions/listAllUsers')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

});

describe('List Drivers', () => {

    it('should list drivers', done => {
        request(app).post('/use/functions/listDrivers')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should get driver by id', done => {
        request(app).post('/use/functions/getDriverById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idDriver
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list all drivers', done => {
        request(app).post('/use/functions/listAllDrivers')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                search: "A",
                order: "+"
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list all drivers by email', done => {
        request(app).post('/use/functions/listAllDrivers')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                email: drivers1[0].email
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list all admins', done => {
        request(app).post('/use/functions/listAdmins')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list drivers documents', done => {
        request(app).post('/use/functions/listDriversDocuments')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list all drivers waiting gateway', done => {
        request(app).post('/use/functions/listDriversWaitingGateway')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list incomplete profiles', done => {
        request(app).post('/use/functions/listIncomplete')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list rejected profiles', done => {
        request(app).post('/use/functions/listRejected')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should list new drivers', done => {
        request(app).post('/use/functions/listNewDrivers')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should get finance by driver', done => {
        request(app).post('/use/functions/getFinanceByDriver')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idDriver
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should get drivers data', done => {
        request(app).post('/use/functions/getDriversData')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idDriver
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should get finance data', done => {
        request(app).post('/use/functions/getFinanceData')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

});

describe('Manage admins', () => {
    // it('should set a passenger as admin', done => {
    //     request(app).post('/use/functions/setAsAdmin')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionToken,
    //             email: passenger[0].email,
    //             userLevel: "admin"
    //         }).end((err, res) => {
    //         expect(res ? res.status : 'error' ).toEqual(200);
    //         done(err);
    //     });
    // }, 10000);

    it('should not set a a passenger as admin because email is invalid', done => {
        request(app).post('/use/functions/setAsAdmin')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                email: "emailzinho@gmail.com",
                userLevel: "admin"
            }).end((err, res) => {
            expect(res.status).toEqual(400);
            done(err);
        });
    }, 10000);

    it('should remove a passenger as admin', done => {
        request(app).post('/use/functions/removeAsAdmin')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                objectId: idPassenger
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should not remove a passenger as admin because there is no idPassenger', done => {
        request(app).post('/use/functions/removeAsAdmin')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            }).end((err, res) => {
            expect(res.status).toEqual(400);
            done(err);
        });
    }, 10000);

    it('should list all Admins', done => {
        request(app).post('/use/functions/listAdmins')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                search: "A"
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            expect(res.body.result.totalAdmins).toEqual(1);
            done(err);
        });
    }, 10000);
});

describe('Manage user', () => {
    it('should block a passenger', done => {
        request(app).post('/use/functions/blockUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should unblock a passenger', done => {
        request(app).post('/use/functions/unblockUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 90000);
});

describe('Convert users', () => {
    it('should convert passenger to driver', done => {
        request(app).post('/use/functions/convertUserToDriver')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should convert driver to passenger', done => {
        request(app).post('/use/functions/convertUserToPassenger')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should delete a passenger', done => {
        request(app).post('/use/functions/deleteUser')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            done(err);
        });
    }, 10000);

    it('should get user by id', done => {
        request(app).post('/use/functions/getUserById')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                userId: idPassenger
            }).end((err, res) => {
            expect(res.status).toEqual(404);
            done(err);
        });
    }, 10000);
});
