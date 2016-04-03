/* test/test_dish.js*/

var request = require('supertest');
var assert = require('assert');
var mongoose = require('mongoose');

var app = require('../app');
var Dishes = require('../models/dishes');

var STRICT_REST = false; // change that to false depending on https://www.coursera.org/learn/server-side-development/lecture/bKtMl/exercise-video-rest-api-with-express-mongodb-and-mongoose/discussions/x1AZIu9SEeWB0QpuSDkq-Q
var HTTP_OK = 200;
var HTTP_CREATED = (STRICT_REST) ? 201 : HTTP_OK;
var HTTP_NOT_FOUND = 404;

/*
 * Data
 */
var dishes_fixture = require('./fixtures/fixtures_dishes');
var new_dish = {
    name: "Apple Pie",
    description: "America's favorite",
    category: "main",
    price: "$8.55",
    image:"images/pie.png",
    label:"test"
};

var new_comment = {
    author: "Bob",
    rating: 3,
    comment: "Greeeaaaaat dish",
};

/*
 * Tests
 */
describe('Dishes', function(){
    beforeEach(function(done){
        Dishes.remove({}, function(err, res) { // don't use drop() as this will occasionnnaly raise a background operation error
            Dishes.insertMany(dishes_fixture, done);
        });
    });

    describe('GET /dish', function(){
        it('respond with code 404 (wrong spelling)', function(done){
            request(app)
                .get('/dish')
                .expect(HTTP_NOT_FOUND, done);
        });
    });

    describe('GET /dishes', function(){
        it('respond with code HTTP_OK + list of dishes', function(done){
            request(app)
                .get('/dishes')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(HTTP_OK)
                .expect(function(res) {
                    assert.deepEqual(res.body, dishes_fixture);
                })
                .end(done);
        });
    });

    describe('DELETE /dishes', function(){
        it('responds with code HTTP_OK', function(done){
            request(app)
                .delete('/dishes')
                .expect(HTTP_OK)
                .expect(function(res) {
                    assert.deepEqual(res.body, { ok: 1, n: 3 });
                })
                .end(done);
        });
    });

    describe('POST /dishes', function(){
        it('HTTP_CREATED + data content', function(done){
            request(app)
                .post('/dishes')
                .set('Accept', 'application/json')
                .send(new_dish)
                .expect(HTTP_CREATED)
                .expect(function(res) {
                    assert.ok(res.body._id);
                    assert.equal(res.body.name, new_dish.name);
                    assert.deepEqual(res.body.comments, []);
                })
                .end(done);
        });
    });

    describe('GET /dishes/000000000000000000001200', function(){
        it('respond with code HTTP_OK + data content', function(done){
            request(app)
                .get('/dishes/000000000000000000001200')
                .set('Accept', 'application/json')
                .expect(HTTP_OK)
                .expect(function(res) {
                    assert.deepEqual(res.body, dishes_fixture[1]);
                })
                .end(done);
        });
    });

    describe('PUT /dishes/000000000000000000001200', function(){
        it('respond with code HTTP_OK + data content', function(done){
            request(app)
                .put('/dishes/000000000000000000001200')
                .set('Accept', 'application/json')
                .send(new_dish)
                .expect(HTTP_OK)
                .expect(function(res) {
                    assert.equal(res.body._id, "000000000000000000001200");
                    assert.equal(res.body.name, new_dish.name);
                    assert.deepEqual(res.body.comments, dishes_fixture[1].comments); // Keep old comments : this is *not* a REPLACE operation !
                })
                .end(done);
        });
    });

    describe('DELETE /dishes/000000000000000000001200', function(){
        it('respond with code HTTP_OK + data content', function(done){
            request(app)
                .delete('/dishes/000000000000000000001200')
                .expect(HTTP_OK)
                .expect(function(res) {
                    assert.deepEqual(res.body, dishes_fixture[1]);
                })
                .end(done);
        });
    });


    describe('GET /dishes/000000000000000000001300/comments', function(){
        it('respond with code HTTP_OK + data content', function(done){
            request(app)
                .get('/dishes/000000000000000000001300/comments')
                .set('Accept', 'application/json')
                .expect(HTTP_OK)
                .expect(function(res) {
                    assert.deepEqual(res.body, dishes_fixture[2].comments);
                })
                .end(done);
        });
    });

    describe('POST /dishes/000000000000000000001300/comments', function(){
        it('HTTP_CREATED + data content', function(done){
            request(app)
                .post('/dishes/000000000000000000001300/comments')
                .set('Accept', 'application/json')
                .send(new_comment)
                .expect(HTTP_CREATED)
                .expect(function(res) {
                    assert.ok(res.body.comments[3]._id);
                    assert.equal(res.body.comments[3].author, new_comment.author);
                    assert.equal(res.body.comments[3].rating, new_comment.rating);
                    assert.equal(res.body.comments[3].comment, new_comment.comment);
                })
                .end(done);
        });
    });

    describe('DELETE /dishes/000000000000000000001300/comments', function(){
        it('result code HTTP_OK + all comment cleared', function(done){
            request(app)
                .delete('/dishes/000000000000000000001300/comments')
                .set('Accept', 'application/json')
                .send(new_comment)
                .expect(HTTP_OK)
                .end(function() {
                    request(app)
                        .get('/dishes/000000000000000000001300/comments')
                        .set('Accept', 'application/json')
                        .expect(HTTP_OK)
                        .expect(function(res) {
                            assert.deepEqual(res.body, []);
                        })
                        .end(done);
                });
        });
    });

});