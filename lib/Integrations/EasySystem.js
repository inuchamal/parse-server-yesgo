/**
 * Created by Italo on 09/06/2020.
 */
const conf = require('config');
const Messages = require('../Locales/Messages.js');

class EasySystem {
    constructor(language) {
        this.language = language;
    }

    async notifyPersonalDataChange(driverId) {
        try {
            this._validate();
            await this._makeRequest({
                method: 'PUT',
                path: `/v1/driver/${driverId}/personalData`,
            });
            return Promise.resolve({})
        } catch (e) {
            return Promise.reject(e)
        }
    }

    async checkDriverApproved(cpf) {
        try {
            this._validate();
            const response = await fetch(conf.easySystem.api + `/v1/driver/${cpf}/approved`);
            const { codCooperado } = await response.json();
            return codCooperado;
        } catch (e) {
            return Promise.reject(e)
        }
    }

    async _makeRequest({
        method = 'GET',
        path,
        body,
        api = conf.easySystem.api,
        headers = { Accept: 'application/json' }
    }) {
        try {
            return await fetch(
                new Request(
                    `${api}${path}`,
                    { method, headers, body }
                )
            );
        } catch (err) {
            throw new Error(err);
        }
    }

    _validate() {
        if (conf && conf.easySystem && conf.easySystem.api)
            return;

        console.error('Missing \'easySystem\' params in configs file');
        throw (Messages(this.language).error.ERROR_INTERNAL_SERVER_ERROR);
    }
}

exports.instance = EasySystem;