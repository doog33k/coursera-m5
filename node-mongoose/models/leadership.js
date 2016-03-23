/*
 {
 "name": "Peter Pan",
 "image": "images/alberto.png",
 "designation": "Chief Epicurious Officer",
 "abbr": "CEO",
 "description": "Our CEO, Peter, . . ."
 }*/

// grab the things we need
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var leaderSchema = new Schema ({
   name: {
       type: String,
       required: true
   },
    image: {
        type: String,
        required: true
    },
    designation: {
        type: String,
        required: true
    },
    abbr: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    }
});

var Leader = mongoose.model("Leader", leaderSchema);
module.exports= Leader;

