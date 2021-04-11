const {request, app} = require('../config');
const Faker = require('../Faker/User.js');
const {config} = require('../config');
const Messages = require('../../lib/Locales/Messages.js');
const appId = config.appId;

let amountPassengers = 1;
let listIds = [];
let sessionToken, token, installationId, userId, sessionTokenAdmin;
let meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

let passengers1 = Faker.createPassengers(amountPassengers);
let passengers2 = Faker.createPassengers(amountPassengers);
let passengers3 = Faker.createPassengers(amountPassengers);
let passengers4 = Faker.createPassengers(amountPassengers);
let passengers5 = Faker.createPassengers(amountPassengers);

installationId = passengers1[0].installationId;

let passenger1 = {
    _ApplicationId: appId,
    login: passengers1[0].email,
    password: passengers1[0].password
};

describe('Register Passengers', () => {

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

    it('should accept register all this passengers', done => {
        request(app).post('/use/functions/signUpPassenger')
            .send(passengers1[0])
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                listIds.push(res.body.result.objectId);
                done(err);
            });
    }, 50000);

    it('should not accept register all this passengers because there is wrong field', done => {
        passengers2[0].age = 100;
        request(app).post('/use/functions/signUpPassenger')
            .send(passengers2[0])
            .end((err, res) => {
                expect(res.status).toEqual(400);
                expect(res.body.error).toEqual("Field(s) 'age' not supported.");
                done(err);
            });
    }, 10000);

    it('should not accept register all this passengers because of no specific gender', done => {
        passengers3[0].gender = "NA";
        request(app).post('/use/functions/signUpPassenger')
            .send(passengers3[0])
            .end((err, res) => {
                expect(res.status).toEqual(400);
                expect(res.body.error).toEqual("Gênero inválido. Gêneros possíveis: ");
                done(err);
            });
    }, 10000);

    it('should not accept register all this passengers because of null email and password', done => {
        passengers4[0].email = null;
        passengers4[0].password = null;
        request(app).post('/use/functions/signUpPassenger')
            .send(passengers4[0])
            .end((err, res) => {
                expect(res.status).toEqual(400);
                expect(res.body.error).toEqual("Field(s) 'email,password' are required.");
                done(err);
            });
    }, 10000);

    it('should not accept register all this passengers because of invalid cpf', done => {
        passengers5[0].cpf = '123';
        request(app).post('/use/functions/signUpPassenger')
            .send(passengers5[0])
            .end((err, res) => {
                expect(res.status).toEqual(400);
                expect(res.body.error).toEqual(Messages("pt").error.ERROR_CPF_INVALID.message);
                done(err);
            });
    }, 10000);
});

describe('Login Passengers', () => {
    it('should login by passenger', done => {
        request(app).post('/use/functions/logInPassenger')
            .send(passenger1)
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.profileStage).toEqual("phoneValidation");
                expect(res.body.result.objectId).not.toBeUndefined();
                expect(res.body.result.sessionToken).not.toBeUndefined();
                sessionToken = res.body.result.sessionToken;
                userId = res.body.result.objectId;
                done(err);
            });
    }, 10000);

    it('should not login by passenger because of there is no register', done => {
        request(app).post('/use/functions/logInPassenger')
            .send({
                _ApplicationId: appId,
                login: 'mariazinha@gmail.com',
                password: "123456"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                expect(res.body.error).toEqual("Nome de usuário ou senha incorretos, tente novamente.");
                done(err);
            });
    }, 10000);
});

describe('Validation code', () => {
    it('should send message code', done => {
        request(app).post('/use/functions/sendSMS')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should not send message code', done => {
        request(app).post('/use/functions/sendSMS')
            .send({
                _ApplicationId: appId
            })
            .end((err, res) => {
                expect(res.status).not.toBe(200);
                done(err);
            });
    }, 10000);

    it('should validate the code', done => {
        request(app).post('/use/functions/validateCode')
            .send({
                _ApplicationId: appId,
                code: '3691',
                _SessionToken: sessionToken
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 10000);

    it('should not validate the code because of invalid code', done => {
        request(app).post('/use/functions/validateCode')
            .send({
                _ApplicationId: appId,
                code: '1234',
                _SessionToken: sessionToken
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                expect(res.body.error).toEqual("Código inválido! O celular não pôde ser cadastrado.");
                done(err);
            });
    }, 10000);

    it('should not validate the code because of invalid user', done => {
        request(app).post('/use/functions/validateCode')
            .send({
                _ApplicationId: appId,
                code: '3691'
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                expect(res.body.error).toEqual("Voce não possui privilégio para realizar esta ação.");
                done(err);
            });
    }, 10000);

    it('should login by passenger', done => {
        request(app).post('/use/functions/logInPassenger')
            .send(passenger1)
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result.profileStage).toEqual("ok");
                sessionToken = res.body.result.sessionToken;
                userId = res.body.result.objectId;
                //installationId = res.body.result.installationId;
                done(err);
            });
    }, 10000);
});

describe('Edit Password', () => {
    it('should not accept edit password by passenger because old password is wrong', done => {
        request(app).post('/use/functions/editPassword')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                oldPassword: 'oldpassword',
                newPassword: 'newpassword'
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 20000);

    it('should not accept edit password by passenger because there is not a new password', done => {
        request(app).post('/use/functions/editPassword')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                oldPassword: 'oldpassword'
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 20000);

    it('should not accept edit password by passenger because there is not a sessionToken', done => {
        request(app).post('/use/functions/editPassword')
            .send({
                _ApplicationId: appId,
                oldPassword: 'oldpassword'
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                done(err);
            });
    }, 20000);

    it('should accept edit password by passenger', done => {
        request(app).post('/use/functions/editPassword')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionToken,
                oldPassword: passengers1[0].password,
                newPassword: 'newpassword'
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 20000);
});

describe('Women Filter', () => {
    it('should on women only filter', done => {
        request(app).post('/use/functions/onWomenOnlyFilter')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId
            })
            .end((err, res) => {
                if (passengers1[0].gender === 'f') {
                    expect(res ? res.status : 'error').toEqual(200);
                } else {
                    expect(res.status).toEqual(400);
                }
                done(err);
            });
    }, 9999999);

    it('should on women only filter', done => {
        request(app).post('/use/functions/offWomenOnlyFilter')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId
            })
            .end((err, res) => {
                if (passengers1[0].gender === 'f') {
                    expect(res ? res.status : 'error').toEqual(200);
                } else {
                    expect(res.status).toEqual(400);
                }
                done(err);
            });
    }, 20000);
});

describe('Updating user', () => {
    it('should update indication code', done => {
        request(app).post('/use/functions/updateIndicationCode')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId,
                code: Faker.createCode()
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 20000);

    it('should not update indication code because it is too long', done => {
        request(app).post('/use/functions/updateIndicationCode')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId,
                code: '123123123123123123123123123123'
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 20000);

    it('should update de user', done => {
        request(app).post('/use/functions/updateUser')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId,
                completingFields: true,
                profileImage: "https://loremflickr.com/320/240/brazil,rio",
                gender: 'M',
                phone: '3635594578',
                cpf: Faker.createCPF(),
                code: Faker.createCode()
            })
            .end((err, res) => {
                // passengers1[0]
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 20000);

    it('should not update de user because birthdate is invalid', done => {
        request(app).post('/use/functions/updateUser')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId,
                completingFields: true,
                birthDate: "datadeaniversario"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 20000);

    //Função updateUser não está conferindo se phone é um número de telefone válido
    // it('should not update de user because invalid phone', done => {
    //     request(app).post('/use/functions/updateUser')
    //         .send({
    //             _SessionToken: sessionToken,
    //             _ApplicationId: appId,
    //             completingFields: true,
    //             phone: "123"
    //         })
    //         .end((err, res) => {
    //             expect(res.status).toEqual(400);
    //             done(err);
    //         });
    // }, 9999999);

    it('should not update de user because there is not sessionToken', done => {
        request(app).post('/use/functions/updateUser')
            .send({
                _ApplicationId: appId,
                completingFields: true
            })
            .end((err, res) => {
                expect(res.status).not.toBe(200);
                done(err);
            });
    }, 9999999);
});

describe('Update gender', () => {
    it('should not update de user because gender is invalid', done => {
        request(app).post('/use/functions/updateUser')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId,
                completingFields: true,
                gender: 'k'
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 20000);

    it('should verify if gender was not modified', done => {
        request(app).post('/use/functions/getUserById')
            .send({
                _SessionToken: sessionTokenAdmin,
                _ApplicationId: appId,
                userId: userId
            })
            .end((err, res) => {
                expect(res.status).toEqual(200);
                expect(res.body.result.gender).not.toEqual('k');
                done(err);
            });
    }, 20000);
});

describe('Recover Password', () => {
    it('should accept send email for password recover', done => {
        request(app).post('/use/functions/recoverPassword')
            .send({
                _ApplicationId: appId,
                email: passengers1[0].email
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                token = res.body.result.token;
                done(err);
            });
    }, 20000);

    it('should not accept recover the password', done => {
        request(app).post('/use/functions/recoverPassword')
            .send({
                _ApplicationId: appId,
                email: "emailinvalido@gmail.com"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 20000);

    it('should get token', done => {
        request(app).post('/use/functions/getToken')
            .send({
                _ApplicationId: appId,
                email: passengers1[0].email
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                token = res.body.result;
                done(err);
            });
    }, 20000);

    it('should change the password', done => {
        request(app).post('/use/functions/updateRecoverPassword')
            .send({
                _ApplicationId: appId,
                username: passengers1[0].email,
                password: "mynewpassword",
                token: token,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 20000);

    it('should login by passenger', done => {
        request(app).post('/use/functions/logInPassenger')
            .send({
                login: passengers1[0].email,
                password: "mynewpassword",
                _ApplicationId: appId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                sessionToken = res.body.result.sessionToken;
                done(err);
            });
    }, 20000);
});

describe('Mark as read', () => {
    it('should mark as read', done => {
        request(app).post('/use/functions/markAsReady')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 20000);
});

describe('Profile', () => {

    it('should get my informations', done => {
        request(app).post('/use/functions/getMe')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 20000);

    it('should show profile informations', done => {
        request(app).post('/use/functions/profileInfo')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId,
                userId: listIds[0],
                type: 'user'
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                let data = new Date();
                let dia = data.getDate().toString();
                let diaF = (dia.length === 1) ? '0' + dia : dia;
                let mes = (data.getMonth() + 1).toString(); // +1 pois no getMonth Janeiro começa com zero.
                let mesF = meses[mes-1];
                let anoF = data.getFullYear();
                expect(res.body.result.date).toEqual("Usuário desde " + diaF + " de " + mesF + " de " + anoF);
                done(err);
            });
    }, 20000);

    it('should not show profile informations', done => {
        request(app).post('/use/functions/profileInfo')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId,
                userId: listIds[0],
                type: 'adm'
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 20000);

    it('should not show profile informations', done => {
        request(app).post('/use/functions/profileInfo')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId,
                type: 'user'
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                done(err);
            });
    }, 20000);

    it('should show user profile', done => {
        request(app).post('/use/functions/userProfile')
            .send({
                _SessionToken: sessionToken,
                _ApplicationId: appId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                done(err);
            });
    }, 20000);
});

describe('Logout Passenger', () => {
    it('should logout by passenger', done => {
        request(app).post('/use/functions/logout')
            .send({
                _SessionToken: sessionToken,
                offset: -180,
                installationId: installationId,
                _ApplicationId: appId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(200);
                expect(res.body.result).toEqual("O objeto foi atualizado com sucesso");
                done(err);
            });
    }, 20000);

    it('should not logout by passenger because there is no offset', done => {
        request(app).post('/use/functions/logout')
            .send({
                //offset: -180,
                //installationId: installationId,
                _ApplicationId: appId
            })
            .end((err, res) => {
                expect(res ? res.status : 'error').toEqual(400);
                expect(res.body.error).toEqual("Field(s) 'installationId,offset' are required.");
                done(err);
            });
    }, 20000);
});
