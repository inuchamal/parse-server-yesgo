'use strict';

let Mock = {
    autocompletePlacesMock: function () {
        return "Ej1QcmHDp2EgVGlyYWRlbnRlcywgT3VybyBQcmV0byAtIFN0YXRlIG9mIE1pbmFzIEdlcmFpcywgQnJhemlsIi4qLAoUChIJr-l4HOAKpAARJMwXh8jmwr8SFAoSCeU1iVVa-KMAEbBs18ZfWfjY";
    },

    autocompletePlacesMock2: function () {
        return "ChIJ-0ZjM9yZpgARK3KL0Sml12w";
    },

    autocompletePlacesMock3: function () {
        return "ChIJq38E2gICpAARj-qDzBh0EL4";
    },

    autocompletePlacesMock4: function () {
        return "ChIJ8Y0Xze4KpAARU1FdAOdkqNo";
    },

    getRouteMock: function () {
        return {
            origin: {
                "latitude": -20.394775,
                "longitude": -43.505897,
                "number": "289",
                "address": "Rua Santo Antônio do Salto",
                "neighborhood": "Vila Aparecida",
                "city": "Ouro Preto",
                "state": "Minas Gerais",
                "zip": "35400-000" },
            destiny: {
                "latitude": -20.385008,
                "longitude": -43.503378,
                "number": "",
                "address": "Praça Tiradentes",
                "neighborhood": "",
                "city": "Ouro Preto",
                "state": "Minas Gerais",
                "zip": "35400-000" },
            distance: 1.995,
            duration: 0.86
        };
    },

    getRouteMock2: function () {
        return {
            origin: {
            "latitude": -19.9284588,
            "longitude": -43.9350393,
            "number": "175",
            "address": "Rua Sergipe",
            "neighborhood": "Boa Viagem",
            "city": "Belo Horizonte",
            "state": "Minas Gerais",
            "zip": "30140-060"},
            destiny: {
                "latitude": -19.9319811,
                "longitude": -43.9380019,
                "number": "s/n",
                "address": "Praça da Liberdade",
                "neighborhood": "Funcionários",
                "city": "Belo Horizonte",
                "state": "Minas Gerais",
                "zip": "30140-010"},
            distance: 0.782,
            duration: 0.348
        }
    },

    getRouteMock3: function () {
        return {
            origin: {
                "latitude": -20.241037,
                "longitude": -43.803765,
                "number": "358",
                "address": "Rua Doutor Antônio Lisboa",
                "neighborhood": "Conjunto Iapi",
                "city": "Itabirito",
                "state": "Minas Gerais",
                "zip": "35450-000"},
            destiny: {
                "latitude": -20.2500669,
                "longitude": -43.8041901,
                "number": "635",
                "address": "Avenida Queiroz Júnior",
                "neighborhood": "Praia",
                "city": "Itabirito",
                "state": "Minas Gerais",
                "zip": "35450-000"},
            distance: 1.144,
            duration: 0.437
        }
    },

    getRouteMock4: function () {
        return {
            origin: {
                "latitude": -20.4005033,
                "longitude": -43.51105099999999,
                "number": "151",
                "address": "Rua Professor Francisco Pignataro",
                "neighborhood": "Bauxita",
                "city": "Ouro Preto",
                "state": "Minas Gerais",
                "zip": "35400-000"
            },
            destiny: {
                "latitude": -20.3957722,
                "longitude": -43.5078521,
                "number": "106",
                "address": "Rua Cinco",
                "neighborhood": "Bauxita",
                "city": "Ouro Preto",
                "state": "Minas Gerais",
                "zip": "35400-000"
            },
            distance: 1175,
            duration: 277
        }
    }

};
module.exports = Mock;