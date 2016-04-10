/* test/fixtures/fixtures_favorites.js */

module.exports = [
// all passwords are "password" (without quotes)
    {
        "_id" : "000000000000000000010000",
        "postedBy" : "56f856c56ef091173981d864", /* Sonia */
        "dishes": [
            "000000000000000000001100",
            "000000000000000000001300",
        ],
        "__v" : 0
    },
    {
        "_id" : "000000000000000000010001",
        "postedBy" : "56f856c56ef091173981d865", /* Sylvain */
        "dishes": [
        ],
        "__v" : 0
    },
    /* no favorites for homer */

    {
        "_id" : "000000000000000000010005",
        "postedBy" : "56f856c56ef091173981d868", /* ??? */
        "dishes": [
            "000000000000000000001100",
        ],
        "__v" : 0
    },
]