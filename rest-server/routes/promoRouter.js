var bodyParser = require('body-parser');
var express = require('express');
var mongoose = require('mongoose');

var Promos = require('../models/promotions');

module.exports = (function() {
    'use strict';
    var promoRouter = express.Router();

    promoRouter.use(bodyParser.json());

    promoRouter.route('/')
        .get(function(req,res,next){
            Promos.find({}, function (err, promo) {
                if (err) throw err;
                res.json(promo);
            });
        })

        .post(function(req, res, next){
            Promos.create(req.body, function (err, promo) {
                if (err) throw err;
                console.log('Promo created!');
                res.json(promo);
            });
        })

        .delete(function(req, res, next){
            Promos.remove({}, function (err, resp) {
                if (err) throw err;
                res.json(resp);
            });
        });

    promoRouter.route('/:promoId')

        .get(function (req, res, next) {
            Promos.findById(req.params.promoId, function (err, promo) {
                if (err) throw err;
                res.json(promo);
            });
        })

        .put(function(req, res, next){
            Promos.findByIdAndUpdate(req.params.promoId, {
                $set: req.body
            }, {
                new: true
            }, function (err, promo) {
                if (err) throw err;
                res.json(promo);
            });
        })

        .delete(function(req, res, next){
            Promos.findByIdAndUpdate(req.params.promoId, {
                $set: req.body
            }, {
                new: true
            }, function (err, promo) {
                if (err) throw err;
                res.json(promo);
            });
        });


    return promoRouter;
})();