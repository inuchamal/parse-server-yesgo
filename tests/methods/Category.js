const {request, app} = require('../config');
const Faker = require('../Faker/Category.js');
const {config} = require('../config');
const appId = config.appId;

let amountCategory = 5;
let catId = [];
let sessionTokenAdmin;

let category = Faker.createCategory(amountCategory);
let categoryDeactivate = Faker.createCategoryDeactivate(amountCategory);
let categoryInvalidYear = Faker.createCategory(1);

describe('Create category', () => {
    it('should login with admin', done => {
        request(app).post('/use/functions/logIn')
            .send({
                _ApplicationId: appId,
                login: "Talita.Moreira51@bol.com.br",
                password: "4kBlduiO6V7jddJ"
            }).end((err, res) => {
            expect(res ? res.status : 'error' ).toEqual(200);
            expect(res.body.result.sessionToken).not.toBeUndefined();
            sessionTokenAdmin = res.body.result.sessionToken;
            done(err);
        });
    }, 10000);

    it('should not create a category because the year is invalid', done => {
        categoryInvalidYear[0].year = "ABC";
        categoryInvalidYear[0]._SessionToken = sessionTokenAdmin;
        request(app).post('/use/functions/createCategory')
            .send(categoryInvalidYear[0])
            .end((err, res) => {
                expect(res.status).toEqual(400);
                expect(res.body.error).toEqual("Ano inválido!");
                done(err);
            });
    }, 10000);

    //Esse teste está dando problema porque o retorno da função está com erro!
    // it('should not create a category because arrows is not a array', done => {
    //     request(app).post('/use/functions/createCategory')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionTokenAdmin,
    //             name: "Barco",
    //             description: "Jet Ski",
    //             description_en: "Jet Ski",
    //             icon: "icon.png",
    //             percentCompany: 12,
    //             type: "common",
    //             minCapacity: 12,
    //             maxCapacity: 16,
    //             active: true,
    //             year: "2018",
    //             allows: "udC2a5gUmr"
    //         })
    //         .end((err, res) => {
    //             expect(res.status).toEqual(400);
    //             expect(res.body.error).toEqual("O campo allows está com o formato inválido");
    //             done(err);
    //         });
    // }, 10000);

    //Esse teste está dando problema porque o retorno da função está com erro!
    //Conferir se o erro no código foi arrumado. Esse teste só deve ser feito se a plataforma for multilingual!!!!
    // it('should not create a category because there is not an english description', done => {
    //     request(app).post('/use/functions/createCategory')
    //         .send({
    //             _ApplicationId: appId,
    //             _SessionToken: sessionTokenAdmin,
    //             name: "Barco",
    //             description: "Jet Ski",
    //             icon: "icon.png",
    //             percentCompany: 12,
    //             type: "common",
    //             minCapacity: 12,
    //             maxCapacity: 16,
    //             active: true,
    //             year: "2008",
    //             allows: ["yhYI8HPvms", "CLJeO62EIh", "udC2a5gUmr"]
    //         })
    //         .end((err, res) => {
    //             expect(res.status).toEqual(400);
    //             expect(res.body.error).toEqual("O campo descrição deve ser enviado também em outro idioma");
    //             done(err);
    //         });
    // }, 10000);

    it('should create a category', done => {
        for (let i = 0; i < category.length; i = i + 1) {
            category[i]._SessionToken = sessionTokenAdmin;
            request(app).post('/use/functions/createCategory')
                .send(category[i])
                .end((err, res) => {
                    expect(res ? res.status : 'error' ).toEqual(200);
                    expect(res.body.result.message).toEqual("O objeto foi criado com sucesso");
                    expect(res.body.result.objectId).not.toBeUndefined();
                    done(err);
                });
        }
    }, 10000);

    //create category com allows

    it('should create deactivate categories', done => {
        for (let i = 0; i < categoryDeactivate.length; i = i + 1) {
            categoryDeactivate[i]._SessionToken = sessionTokenAdmin;
            request(app).post('/use/functions/createCategory')
                .send(categoryDeactivate[i])
                .end((err, res) => {
                    expect(res ? res.status : 'error' ).toEqual(200);
                    expect(res.body.result.message).toEqual("O objeto foi criado com sucesso");
                    expect(res.body.result.objectId).not.toBeUndefined();
                    done(err);
                });
        }
    }, 10000);
});

describe('List categories', () => {
    it('should list actived categories', done => {
        request(app).post('/use/functions/listCategories')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.length === amountCategory).toEqual(true);
                for (let i = 0; i < amountCategory; i = i + 1) {
                    expect(res.body.result[i].objectId).not.toBeUndefined();
                    catId.push(res.body.result[i].objectId);
                }
                done(err);
            });
    }, 10000);

    it('should list all categories', done => {
        request(app).post('/use/functions/listAllCategories')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.length === (2 * amountCategory)).toEqual(true);
                for (let i = 0; i < amountCategory; i = i + 1) {
                    expect(res.body.result[i].objectId).not.toBeUndefined();
                    expect(res.body.result[i].name).not.toBeUndefined();
                    expect(res.body.result[i].type).not.toBeUndefined();
                    expect(res.body.result[i].minCapacity).not.toBeUndefined();
                    expect(res.body.result[i].maxCapacity).not.toBeUndefined();
                    expect(res.body.result[i].year).not.toBeUndefined();
                    expect(res.body.result[i].percentCompany).not.toBeUndefined();
                    expect(res.body.result[i].active).not.toBeUndefined();
                    expect(res.body.result[i].counter).not.toBeUndefined();
                    expect(res.body.result[i].description).not.toBeUndefined();
                    expect(res.body.result[i].allows).not.toBeUndefined();
                }
                done(err);
            });
    }, 10000);

    it('should deactivate category', done => {
        request(app).post('/use/functions/deactivateCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                catId: catId[0]
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result).toEqual("O objeto foi atualizado com sucesso");
                done(err);
            });
    }, 10000);

    it('should list actived categories', done => {
        request(app).post('/use/functions/listCategories')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.length === (amountCategory - 1)).toEqual(true);
                for (let i = 0; i < (amountCategory - 1); i = i + 1) {
                    expect(res.body.result[i].objectId).not.toBeUndefined();
                }
                done(err);
            });
    }, 10000);

    it('should active category', done => {
        request(app).post('/use/functions/activateCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                catId: catId[0]
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result).toEqual("O objeto foi atualizado com sucesso");
                done(err);
            });
    }, 10000);

    it('should list actived categories', done => {
        request(app).post('/use/functions/listCategories')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.length === amountCategory).toEqual(true);
                for (let i = 0; i < amountCategory; i = i + 1) {
                    expect(res.body.result[i].objectId).not.toBeUndefined();
                }
                done(err);
            });
    }, 10000);

    it('should list finance by categories', done => {
        request(app).post('/use/functions/financeByCategories')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.categories.length === (2*amountCategory)).toEqual(true);
                done(err);
            });
    }, 10000);
});

describe('Edit categories', () => {
    it('should update category', done => {
        request(app).post('/use/functions/updateCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                catId: catId[0],
                minCapacity: 1,
                maxCapacity: 4
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result).toEqual("O objeto foi atualizado com sucesso");
                done(err);
            });

    }, 10000);

    it('should not edit category because allows is invalid', done => {
        request(app).post('/use/functions/editCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                catId: catId[0],
                allows: "allowinvalid"
            })
            .end((err, res) => {
                expect(res.status).toEqual(400);
                expect(res.body.error).toEqual("O campo allows está com formato inválido.");
                expect(res.body.code).toEqual(665);
                done(err);
            });

    }, 10000);

    it('should edit category', done => {
        request(app).post('/use/functions/editCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                catId: catId[0],
                minCapacity: 2,
                maxCapacity: 6,
                percentCompany: 20
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result).toEqual("O objeto foi atualizado com sucesso");
                done(err);
            });

    }, 10000);
});

describe('Delete categories', () => {
    it('should delete category', done => {
        request(app).post('/use/functions/deleteCategory')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
                catId: catId[0]
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result).toEqual("O objeto foi removido com sucesso");
                done(err);
            });

    }, 10000);

    it('should list all categories', done => {
        request(app).post('/use/functions/listAllCategories')
            .send({
                _ApplicationId: appId,
                _SessionToken: sessionTokenAdmin,
            })
            .end((err, res) => {
                expect(res ? res.status : 'error' ).toEqual(200);
                expect(res.body.result.length === (2 * amountCategory) - 1).toEqual(true);
                for (let i = 0; i < (2 * amountCategory) - 1; i = i + 1) {
                    expect(res.body.result[i].objectId).not.toBeUndefined();
                }
                done(err);
            });
    }, 10000);
});
