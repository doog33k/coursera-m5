/* test/test_promo.js*/

var request = require('supertest');
var assert = require('assert');
var mongoose = require('mongoose');

var app = require('../app');
var Promotions = require('../models/promotions');

var STRICT_REST = true; // change that to false depending on https://www.coursera.org/learn/server-side-development/lecture/bKtMl/exercise-video-rest-api-with-express-mongodb-and-mongoose/discussions/x1AZIu9SEeWB0QpuSDkq-Q
var HTTP_OK = 200;
var HTTP_CREATED = (STRICT_REST) ? 201 : HTTP_OK;
var HTTP_NOT_FOUND = 404;

/*
 * Data
 */
var promotions_fixture = require('./fixtures/fixtures_promotions');
var new_promo = {

};

/*
 * Tests
 */