var bodyParser = require('body-parser');
var express = require('express');
var mongoose = require('mongoose');

var Leaders = require('../models/leadership');

module.exports = (function() {
    'use strict';
    var leaderRouter = express.Router();

    leaderRouter.use(bodyParser.json());

    leaderRouter.route('/')
        .get(function(req,res,next){
            Leaders.find({}, function (err, leader) {
                if (err) throw err;
                res.json(leader);
            });
        })

        .post(function(req, res, next){
            Leaders.create(req.body, function (err, leader) {
                if (err) throw err;
                console.log('Leader created!');
                res.json(leader);
            });
        })

        .delete(function(req, res, next){
            Leaders.remove({}, function (err, resp) {
                if (err) throw err;
                res.json(resp);
            });
        });

    leaderRouter.route('/:leaderId')

        .get(function (req, res, next) {
            Leaders.findById(req.params.leaderId, function (err, leader) {
                if (err) throw err;
                res.json(leader);
            });
        })

        .put(function(req, res, next){
            Leaders.findByIdAndUpdate(req.params.leaderId, {
                $set: req.body
            }, {
                new: true
            }, function (err, leader) {
                if (err) throw err;
                res.json(leader);
            });
        })

        .delete(function(req, res, next){
            Leaders.findByIdAndUpdate(req.params.leaderId, {
                $set: req.body
            }, {
                new: true
            }, function (err, leader) {
                if (err) throw err;
                res.json(leader);
            });
        });


    return leaderRouter;
})();