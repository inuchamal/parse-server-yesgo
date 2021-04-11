module.exports = {
    success: (args) => {
        return args
    },
    error: (e, e2) => {
        throw (e2 ? new Parse.Error(e, e2) : e)
    }
}
