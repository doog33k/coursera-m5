var bodyParser = require('body-parser');
var express = require('express');
var mongoose = require('mongoose');

var Leaders = require('../models/leadership');
var Verify = require('./verify');

module.exports = (function() {
    'use strict';
    var leaderRouter = express.Router();

    leaderRouter.use(bodyParser.json());

    leaderRouter.route('/')
        .get(Verify.verifyOrdinaryUser, function(req,res,next){
            Leaders.find({}, function (err, leader) {
                if (err) throw err;
                res.json(leader);
            });
        })

        .post(Verify.verifyOrdinaryUser,Verify.verifyAdmin, function(req, res, next){
            Leaders.create(req.body, function (err, leader) {
                if (err) throw err;
                console.log('Leader created!');
                res.json(leader);
            });
        })

        .delete(Verify.verifyOrdinaryUser,Verify.verifyAdmin, function(req, res, next){
            Leaders.remove({}, function (err, resp) {
                if (err) throw err;
                res.json(resp);
            });
        });

    leaderRouter.route('/:leaderId')

        .get(Verify.verifyOrdinaryUser, function (req, res, next) {
            Leaders.findById(req.params.leaderId, function (err, leader) {
                if (err) throw err;
                res.json(leader);
            });
        })

        .put(Verify.verifyOrdinaryUser,Verify.verifyAdmin, function(req, res, next){
            Leaders.findByIdAndUpdate(req.params.leaderId, {
                $set: req.body
            }, {
                new: true
            }, function (err, leader) {
                if (err) throw err;
                res.json(leader);
            });
        })

        .delete(Verify.verifyOrdinaryUser,Verify.verifyAdmin, function(req, res, next){
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