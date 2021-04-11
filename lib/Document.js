'use strict';
const utils = require('./Utils.js');
const Define = require('./Define.js');
const conf = require('config');
const Messages = require('./Locales/Messages.js');
const RedisJobInstance = require('./RedisJob.js').instance();
const response = require('./response');
const listFields = ['verifyDate', 'linkBack', 'hasBack', 'name', 'name_en', 'description', 'description_en', 'required', 'language', 'link', 'link_en', 'roundPicture', 'updatedAt', 'authData', 'createdAt', 'objectId', 'ACL', '_perishable_token', '_email_verify_token', 'emailVerified', 'code'];
const listRequiredFields = [];

function Document(request) {
    const DOCUMENT_TOTAL_KEY = 'totalDocuments';
    const DOCUMENT_LIST_KEY = 'documents';
    const DEFAULT_LIMIT = 10;
    const DEFAULT_PAGE = 1;
    let _request = request;
    let _response = response;
    let _currentUser = request ? request.user : null;
    let _params = request ? request.params : null;
    let _language = _currentUser ? _currentUser.get('language') : null;

    let _super = {
        beforeSave: function () {
            let object = _request.object;
            let wrongFields = utils.verify(object.toJSON(), listFields);
            if (wrongFields.length > 0) {
                _response.error('Field(s) \'' + wrongFields + '\' not supported.');
            }
            let requiredFields = utils.verifyRequiredFields(object.toJSON(), listRequiredFields);
            if (requiredFields.length > 0) {
                _response.error('Field(s) \'' + requiredFields + '\' are required.');
                return;
            }
            if (object.isNew()) {
            }
          return _response.success();
        },
        beforeDelete: function () {
            if (request.master) {
              return _response.success();
            } else {
                _response.error(Messages().error.ERROR_UNAUTHORIZED);
            }
        },
        contDocuments: function (search, order, filter) {
            let query = _super.filterDocuments(search, order, filter);

            return query.count({useMasterKey: true});
        },
        filterDocuments: function (search, order, filter) {
            let query = new Parse.Query('Document');

            if (search) {
                search = search.toLowerCase().trim();

                let queryName = new Parse.Query('Document');
                queryName.matches('name', search, 'i');

                query = Parse.Query.or(queryName);
            }

            if (order) {
                let method = order[0] === '+'
                    ? 'ascending'
                    : 'descending';

                query[method](order.substring(1));
            }

            if (filter) {
                if (filter.isRequired !== undefined && filter.isRequired !== '') {
                    query.equalTo('isRequired', filter.isRequired);
                }
                if (filter.startDate != null) {
                    filter.startDate = new Date(filter.startDate.setHours(0, 0, 0));

                    query.greaterThanOrEqualTo('createdAt', filter.startDate);
                }
                if (filter.endDate != null) {
                    let hours = filter.endDate.getHours();
                    filter.endDate = new Date(filter.endDate.setHours(23, 59, 59));
                    query.lessThanOrEqualTo('createdAt', filter.endDate);
                }
            }

            return query;
        },
        listDocuments: function (search, order, filter, limit = DEFAULT_LIMIT, page = DEFAULT_PAGE) {
            page = (page - 1) * limit;
            let query = _super.filterDocuments(search, order, filter);
            query.limit(limit);
            query.skip(page);

            return query.find({useMasterKey: true});
        },
        getDocumentById: function (id) {
            let query = new Parse.Query('Document');

            return query.get(id, {useMasterKey: true});
        },

        publicMethods: {
            createDocument: function () {
                if (utils.verifyAccessAuth(_currentUser, ['admin'], _response)) {
                    let fields = ['name', 'description', 'required', 'link'];
                    if (_params.hasBack)
                        fields.push("linkBack");
                    if (utils.verifyRequiredFields(_params, fields, _response)) {
                        let doc = new Define.Document();
                        if (_params.name === 'Foto de Perfil') _params.roundPicture = true;
                        else _params.roundPicture = false;
                        return doc.save(_params).then(function () {
                          return _response.success(Messages(_language).success.CREATED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            addLinkToDocument: function () {
                if (utils.verifyAccessAuth(_currentUser, ['admin'], _response)) {
                    if (utils.verifyRequiredFields(_params, ['docId'], _response)) {
                        return utils.getObjectById(_params.docId, Define.Document).then(function (doc) {
                            if (!_params.link && !_params.linkBack)
                                return Promise.reject(Messages(_language).error.ERROR_SEND_DOCUMENT);
                            if (_params.linkBack)
                                doc.set('linkBack', _params.linkBack);
                            if (_params.link)
                                doc.set('link', _params.link);
                            return doc.save();
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            updateDocument: function () {
                if (utils.verifyAccessAuth(_currentUser, ['admin'], _response)) {
                    if (utils.verifyRequiredFields(_params, ['docId'], _response)) {
                        return _super.getDocumentById(_params.docId).then(function (doc) {
                            delete _params.docId;
                            return doc.save(_params);
                        }).then(function () {
                          return _response.success(Messages(_language).success.EDITED_SUCCESS);
                        }, function (error) {
                            _response.error(error.code, error.message);
                        });
                    }
                }
            },
            listAllDocuments: async function () {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ['admin'], _response)) {
                        let output = {};
                        output[DOCUMENT_TOTAL_KEY] = await _super.contDocuments(_params.search, _params.order, _params.filter);
                        let data = await _super.listDocuments(_params.search, _params.order, _params.filter, _params.limit, _params.page);
                        if (_params.fromUser) {
                            data = data.filter(doc => doc.get('code') !== 'CRLV' && doc.get('code') !== 'PROFILE_PICTURE');
                            output[DOCUMENT_TOTAL_KEY] = data.length;
                        }
                        let responseList = data.map(async document => {
                            const count = await utils.findObject(Define.UserDocument, {document: document}, true);
                            const json = utils.formatObjectToJson(document, [
                                'name',
                                'name_en',
                                'description',
                                'description_en',
                                'createdAt',
                                'ACL',
                                'link',
                                'link_en',
                                'required',
                                'roundPicture',
                                'code',
                                'hasBack',
                                'linkBack',
                                'verifyDate'
                            ]);
                            json.createdAt = utils.formatDate(json.createdAt, true);
                            json.canDelete = !count;
                            return json;
                        });
                        output[DOCUMENT_LIST_KEY] = await Promise.all(responseList);
                      return _response.success(output);
                    }
                } catch (e) {
                    _response.error(e.code, e.message);
                }
            },
            getDocumentById: async function () {
                if (utils.verifyAccessAuth(_currentUser, ['admin'], _response)) {
                    if (utils.verifyRequiredFields(_params, ['id'], _response)) {
                        let output = {};
                        try {
                            const document = await _super.getDocumentById(_params.id);
                            output = utils.formatObjectToJson(document, ['name', 'name_en', 'description', 'description_en', 'createdAt', 'ACL', 'link', 'link_en', 'required', 'roundPicture', 'linkBack', 'hasBack', 'verifyDate', 'code']);
                            output.createdAt = utils.formatDate(output.createdAt, true);
                          return _response.success(output);
                        } catch (e) {
                            _response.error(e.code, e.message);
                        }
                    }
                }
            },
            deleteDocument: async () => {
                try {
                    if (utils.verifyAccessAuth(_currentUser, ["admin"], _response)) {
                        if (utils.verifyRequiredFields(_params, ["documentId"], _response)) {
                            const document = await utils.getObjectById(_params.documentId, Define.Document);
                            const count = await utils.findObject(Define.UserDocument, {document: document}, true);
                            if (count) throw Messages(_language).error.ERROR_DOCUMENT_IN_USE;
                            const doc = {
                                name: document.get("name"),
                                description: document.get("description"),
                                type: document.get("type")
                            };
                            await document.destroy({useMasterKey: true});
                            RedisJobInstance.addJob("Logger", "logDeleteDocument", {
                                objectId: _params.documentId,
                                admin: _currentUser.id,
                                oldInfo: doc
                            });
                          return _response.success(Messages(_language).success.DELETED_SUCCESS);
                        }
                    }
                } catch (error) {
                    _response.error(error.code, error.message);
                }
            },
        },
    };
    return _super;
}

exports.instance = Document;

/* CALLBACKS */
Parse.Cloud.beforeSave('Document', async function (request) {
    await Document(request).beforeSave();
});
Parse.Cloud.beforeDelete('Document', async function (request) {
    await Document(request).beforeDelete();
});
for (let key in Document().publicMethods) {
    Parse.Cloud.define(key, async function (request) {
        if (conf.enableLog) utils.printLogAPI(request);
        return await Document(request).publicMethods[request.functionName]();
    });
}
