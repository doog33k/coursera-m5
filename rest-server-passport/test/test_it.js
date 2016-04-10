/* test/test_it.js*/

var request = require('supertest');
var assert = require('assert');
var mongoose = require('mongoose');

var app = require('../app');
var Promotions = require('../models/promotions');
var Dishes = require('../models/dishes');
var User = require('../models/user');

var Favorites = null;
try {
    Favorites = require('../models/favorites');
}
catch(err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
}

var Verify = require('../routes/verify');


var OAUTH_PROVIDER = 'facebook'; // change that to 'google', 'github', ... or hatever else you used
var TIMEOUT = 8000;
var TEST_PORT = 3000;
var TEST_SEC_PORT = TEST_PORT+443;
var HOSTNAME = 'localhost';
var INSEC_SERVER = `http://${HOSTNAME}:${TEST_PORT}`
var SEC_SERVER = `https://${HOSTNAME}:${TEST_SEC_PORT}`
var SERVER = INSEC_SERVER; // Default to insecure server for compatibility
                           // with previous weeks exercises.
                           // Will be updated as part of W4 - Ex2 if a server
                           // is listening on the secure port


/*
 Possible race condition here as the tests might start before the server
 were listening.

 A much better alternative would require the module rewire[1] to access the
 non-exported variable server and secServer, and then add onListen handlers.

 [1] https://github.com/jhnns/rewire
 */
process.env.PORT = TEST_PORT
var www = require('../bin/www');



/*
 *                           /!\ DANGER :
 *
 *                         INSECURE SETTING
 *
 * USE THAT ONLY FOR TESTING PURPOSES IN ORDER TO ACCEPT SELF SIGNED CERTIFICATES
 *
 * See http://stackoverflow.com/a/29397100/2363712 for a less insecure solution
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/* end of DANGER zone */

var STRICT_REST = false; // change that to false depending on https://www.coursera.org/learn/server-side-development/lecture/bKtMl/exercise-video-rest-api-with-express-mongodb-and-mongoose/discussions/x1AZIu9SEeWB0QpuSDkq-Q
var HTTP_OK = 200;
var HTTP_CREATED = (STRICT_REST) ? 201 : HTTP_OK;
var HTTP_FOUND = 302;
var HTTP_FORBIDDEN = 403;
var HTTP_UNAUTHORIZED = (STRICT_REST) ? 401 : HTTP_FORBIDDEN; // See http://stackoverflow.com/questions/3297048/403-forbidden-vs-401-unauthorized-http-responses
var HTTP_NOT_FOUND = 404;


/*
 * Data
 */
var dishes_fixture = require('./fixtures/fixtures_dishes');
var promotions_fixture = require('./fixtures/fixtures_promotions');
var users_fixture = require('./fixtures/fixtures_users');
var favorites_fixture = require('./fixtures/fixtures_favorites');
var new_promotion = {
    "name" : "St Valentin Special",
    "image" : "images/pink.png",
    "label" : "Hot",
    "price" : 1490,
    "description" : "All pink dishes !",
};

/*
 * Utility
 */
function login(username, password, callback, timeout) {
    timeout = timeout || 200;
    request(SERVER)
        .post('/users/login')
        .send({username: username, password: password})
        .end(function(err, res) {
            if (err) {
                console.log(err);
                throw err;
            }
            // Ugly retry loop as, apparently, there might be delay before being able
            // to log in and after user creation ?!? <-- THIS IS WRONG !!
            if (res.error && (timeout < 2000)) {
                console.log("Retrying login " + username);
                // console.log(res.error);
                setTimeout(function() { login(username, password, callback, timeout+200); },timeout);
            }
            else {
                callback(res);
            }
        });
}

function rendezVous(max, callback) {
    var n = 0;
    return function() {
        /* equality here to ensure only one call to callback no matter
         how many joined the rendez-vous */
        if (++n == max) callback();
    }
}

/*
 * Week 4 -- Exercice 2 tests
 */
describe('Week 4 - exercice 2', function(){
    describe('Server', function() {
        it(`should be listening on ${INSEC_SERVER}`, function(done) {
            request(INSEC_SERVER)
                .get("")
                .end(done);
        });
        it(`should be listening on ${SEC_SERVER}`, function(done) {
            request(SEC_SERVER)
                .get("")
                .expect(HTTP_OK)
                .expect(function(res) {
                    SERVER = SEC_SERVER; // switch to https for functional tests
                })
                .end(done);
        });
        it(`should redirect http requests to https`, function(done) {
            var resources = [
                "/",            // root
                "/index.html",  // static
                "/dishes",
                "/users",
                "/leaders",
                "/promotions",
                "/inexistant",  // inexistant ressource
            ];
            var rdv = rendezVous(resources.length, done);
            for(var resource of resources) {
                request(INSEC_SERVER)
                    .get(resource)
                    .expect(HTTP_FOUND)
                    .expect('location', SEC_SERVER + resource)
                    .end(rdv);
            }
        });
    });
});


/*
 * Week 4 -- Assignment
 */
describe('Assignment 4', function(){
    this.timeout(TIMEOUT);

    beforeEach(function(done){
        /* Nice trick to run several concurent actions and wait for them */
        var rdv = rendezVous(4, done);

        Promotions.remove({}, function(err, res) { // don't use drop() as this will occasionnnaly raise a background operation error
            if (err) console.log(err);
            Promotions.insertMany(promotions_fixture, rdv);
        });
        Dishes.remove({}, function(err, res) { // don't use drop() as this will occasionnnaly raise a background operation error
            if (err) console.log(err);
            Dishes.insertMany(dishes_fixture, rdv);
        });
        User.remove({}, function(err, res) { // don't use drop() as this will occasionnnaly raise a background operation error
            if (err) console.log(err);
            User.insertMany(users_fixture, rdv);
        });

        /* special case as the model might be absent for students having not yet *
         /* reached assignment 4 */
        if (Favorites) {
            Favorites.remove({}, function(err, res) { // don't use drop() as this will occasionnnaly raise a background operation error
                if (err) console.log(err);
                Favorites.insertMany(favorites_fixture, rdv);
            });
        }
        else {
            rdv();
        }
    });

    describe('Favorites model', function(){
        it('exists', function(done) {
            assert.ok(Favorites);
            done();
        });

        if (Favorites) {

            it('sets postedBy and dishes property', function(done) {
                var favorites = [
                    { postedBy: "012345678901234567890123", dishes: [] },
                    { postedBy: "012345678901234567890123", dishes: [
                        "012345678901234567890123",
                    ]},
                    { postedBy: "012345678901234567890123", dishes: [
                        "012345678901234567890123",
                        "012345678901234567890123",
                    ]},
                ]

                for (var favorite of favorites) {
                    var actual = new Favorites(favorite);
                    assert.equal(actual.postedBy,favorite.postedBy);
                    assert.ok(actual.dishes instanceof Array);
                    for(var i in favorite.dishes) {
                        assert.equal(actual.dishes[i], favorite.dishes[i]);
                    }
                }
                done();
            });


            it('should have timestamps', function(done) {
                /* as per assignment video at 04:45 */
                var favorite = new Favorites({postedBy: "012345678901234567890123", dishes: [] });

                favorite.save(function(err, actual) {
                    assert.ok(actual.createdAt);
                    assert.ok(actual.updatedAt);

                    done();
                })
            });

            it('should populate dishes', function(done) {
                var favorite = {
                    postedBy: "56f856c56ef091173981d864",
                    dishes: [
                        "000000000000000000001100"
                    ]
                };

                new Favorites(favorite).populate('dishes', function(err, actual) {
                    if (err) throw err;
                    assert.equal(actual.dishes.length, favorite.dishes.length);
                    assert.equal(actual.dishes[0]._id, favorite.dishes[0]);
                    assert.ok(actual.dishes[0].name);
                    assert.ok(actual.dishes[0].description);

                    done();
                });
            });

            it('should populate user', function(done) {
                var favorite = {
                    postedBy: "56f856c56ef091173981d864",
                    dishes: [
                        "000000000000000000001100"
                    ]
                };

                new Favorites(favorite).populate('postedBy', function(err, actual) {
                    if (err) throw err;
                    assert.equal(actual.postedBy._id, favorite.postedBy);
                    assert.ok(actual.postedBy.username);

                    done();
                });
            });

        }
    });

    describe('Application', function() {
        it('should expose the /favorites endpoint', function(done) {
            request(SERVER)
                .get("/favorites")
                .expect(function(res) {
                    assert.notEqual(res.status, HTTP_NOT_FOUND);
                })
                .end(done);
        });

        it('can GET favorites for the logged in user', function(done) {
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .get('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.ok(res.body);
                        assert.equal(res.body.dishes.length, 2);
                    })
                    .end(done);
            });
        });

        it('populates postedBy when returning favorites', function(done) {
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .get('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.equal(res.body.postedBy._id, "56f856c56ef091173981d864");
                        assert.equal(res.body.postedBy.username, "sonia");
                    })
                    .end(done);
            });
        });

        it('populates dishes when returning favorites', function(done) {
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .get('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.equal(res.body.dishes.length, 2);
                        for(var dish of res.body.dishes) {
                            assert.ok(dish._id);
                            assert.ok(dish.name);
                            assert.ok(dish.description);
                        }
                    })
                    .end(done);
            });
        });

        it("returns null if the user don't have favorites", function(done) {
            /* see https://www.coursera.org/learn/server-side-development/lecture/TsjQf/assignment-4-video-requirements/discussions/o0ZKr_5bEeWbYhLNZ2H1QQ */
            login("homer", "password", function(auth_res) {
                request(SERVER)
                    .get('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.strictEqual(res.body, null);
                    })
                    .end(done);
            });
        });

        it("returns the complete non-populated list of favorites after a POST", function(done) {
            /* see at 04:51 in the assignment 4 video */
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .post('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .send({_id: "012345678901234567890123"})
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        //console.log(res);
                        assert.ok(res.body);
                        assert.equal(res.body.dishes.length, favorites_fixture[0].dishes.length+1);
                        assert.ok(typeof res.body.dishes[0] == 'string'); // dishes non-populated
                        assert.ok(typeof res.body.postedBy == 'string'); // postedBy non-populated
                    })
                    .end(done);
            });
        });

        var THE_FAVORITE_DISH = "000000000000000000001100";

        it("can POST a new favorite to an existing list", function(done) {
            login("sylvain", "password", function(auth_res) {
                request(SERVER)
                    .post('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .send({_id: THE_FAVORITE_DISH})
                    .expect(HTTP_CREATED)
                    .expect(function(res) {
                        assert.equal(res.body.dishes.length, 1);
                        assert.ok(res.body.dishes.indexOf(THE_FAVORITE_DISH) > -1);
                    })
                    .end(function() {
                        request(SERVER)
                            .get('/favorites')
                            .set('Accept', 'application/json')
                            .set('x-access-token', auth_res.body.token)
                            .expect(HTTP_OK)
                            .expect(function(res) {
                                assert.equal(res.body.dishes.length, 1);
                                assert.equal(res.body.dishes[0]._id, THE_FAVORITE_DISH);
                            })
                            .end(done);
                    });
            });
        });

        it("can POST a favorite for an user without favorites", function(done) {
            login("homer", "password", function(auth_res) {
                request(SERVER)
                    .post('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .send({_id: THE_FAVORITE_DISH})
                    .expect(HTTP_CREATED)
                    .expect(function(res) {
                        assert.equal(res.body.dishes.length, 1);
                        assert.ok(res.body.dishes.indexOf(THE_FAVORITE_DISH) > -1);
                    })
                    .end(function() {
                        request(SERVER)
                            .get('/favorites')
                            .set('Accept', 'application/json')
                            .set('x-access-token', auth_res.body.token)
                            .expect(HTTP_OK)
                            .expect(function(res) {
                                assert.equal(res.body.dishes.length, 1);
                                assert.equal(res.body.dishes[0]._id, THE_FAVORITE_DISH);
                            })
                            .end(done);

                    });
            });
        });

        it("will not duplicate favorite dishes", function(done) {
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .post('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .send({_id: THE_FAVORITE_DISH})
                    .expect(HTTP_CREATED)
                    .expect(function(res) {
                        assert.deepEqual(res.body.dishes, favorites_fixture[0].dishes);
                    })
                    .end(function() {
                        request(SERVER)
                            .get('/favorites')
                            .set('Accept', 'application/json')
                            .set('x-access-token', auth_res.body.token)
                            .expect(HTTP_OK)
                            .expect(function(res) {
                                assert.equal(res.body.dishes.length, favorites_fixture[0].dishes.length);
                            })
                            .end(done);
                    });
            });
        });

        it("returns the complete non-populated list of favorites after a DELETE", function(done) {
            /* see at 04:51 in the assignment 4 video */
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .delete('/favorites/' + THE_FAVORITE_DISH)
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        //console.log(res);
                        assert.ok(res.body);
                        assert.equal(res.body.dishes.length, favorites_fixture[0].dishes.length-1);
                        assert.ok(typeof res.body.dishes[0] == 'string'); // dishes non-populated
                        assert.ok(typeof res.body.postedBy == 'string'); // postedBy non-populated
                    })
                    .end(done);
            });
        });

        it("can delete all favorites", function(done) {
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .delete('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .end(function() {
                        request(SERVER)
                            .get('/favorites')
                            .set('Accept', 'application/json')
                            .set('x-access-token', auth_res.body.token)
                            .expect(HTTP_OK)
                            .expect(function(res) {
                                assert.strictEqual(res.body, null);
                            })
                            .end(done);
                    });
            });
        });

        it("returns the deleted favorites when deleting all", function(done) {
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .delete('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.deepEqual(res.body, favorites_fixture[0]);
                    })
                    .end(done);
            });
        });

        it("accepts delete even when the user don't have favorites yet", function(done) {
            login("homer", "password", function(auth_res) {
                request(SERVER)
                    .delete('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .end(function() {
                        request(SERVER)
                            .get('/favorites')
                            .set('Accept', 'application/json')
                            .set('x-access-token', auth_res.body.token)
                            .expect(HTTP_OK)
                            .expect(function(res) {
                                assert.strictEqual(res.body, null);
                            })
                            .end(done);
                    });
            });
        });

        it("won't interfere with other users when deleting favorites", function(done) {
            login("sylvain", "password", function(auth_res) {
                request(SERVER)
                    .delete('/favorites')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .end(function() {
                        login("sonia", "password", function(auth_res) {
                            request(SERVER)
                                .get('/favorites')
                                .set('Accept', 'application/json')
                                .set('x-access-token', auth_res.body.token)
                                .expect(HTTP_OK)
                                .expect(function(res) {
                                    assert.deepEqual(res.body.dishes.map(function(item) { return item._id; }),
                                        favorites_fixture[0].dishes);
                                })
                                .end(done);
                        });
                    });
            });
        });

        it("can delete a specific favorite", function(done) {
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .delete('/favorites/' + THE_FAVORITE_DISH)
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .end(function() {
                        request(SERVER)
                            .get('/favorites')
                            .set('Accept', 'application/json')
                            .set('x-access-token', auth_res.body.token)
                            .expect(HTTP_OK)
                            .expect(function(res) {
                                assert.equal(res.body.dishes.length, 1);
                                assert.ok(res.body.dishes.indexOf(THE_FAVORITE_DISH) == -1);
                            })
                            .end(done);
                    });
            });
        });

        it("accepts delete a specific favorite even if not present", function(done) {
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .delete('/favorites/012345678901234567890123')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .end(function() {
                        request(SERVER)
                            .get('/favorites')
                            .set('Accept', 'application/json')
                            .set('x-access-token', auth_res.body.token)
                            .expect(HTTP_OK)
                            .expect(function(res) {
                                assert.deepEqual(res.body.dishes.map(function(item) { return item._id; }),
                                    favorites_fixture[0].dishes);
                            })
                            .end(done);
                    });
            });
        });

        it("accepts to delete a specific favorite even if no favorites", function(done) {
            login("homer", "password", function(auth_res) {
                request(SERVER)
                    .delete('/favorites/012345678901234567890123')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .end(function() {
                        done();
                    });
            });
        });

        it("won't interfere with other users when deleting a specific favorites", function(done) {
            login("sonia", "password", function(auth_res) {
                request(SERVER)
                    .delete('/favorites/'+THE_FAVORITE_DISH)
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .end(function() {
                        Favorites.find({dishes: THE_FAVORITE_DISH}, function(err, result) {
                            if (err) throw err;

                            assert.ok(result.length > 0);

                            done();
                        })

                    });
            });
        });

        it("can't GET favorites if not logged in", function(done) {
            request(SERVER)
                .get('/favorites')
                .set('Accept', 'application/json')
                .expect(HTTP_UNAUTHORIZED)
                .end(done);
        });

        it("can't POST favorites if not logged in", function(done) {
            request(SERVER)
                .post('/favorites')
                .set('Accept', 'application/json')
                .expect(HTTP_UNAUTHORIZED)
                .end(done);
        });

        it("can't DELETE favorites if not logged in", function(done) {
            request(SERVER)
                .delete('/favorites')
                .set('Accept', 'application/json')
                .expect(HTTP_UNAUTHORIZED)
                .end(done);
        });

    });
});


/*
 * Week 4 -- Exercice 3 tests
 */
describe('Week 4 - exercice 3', function(){
    describe('Application', function() {
        it(`should provide /users/${OAUTH_PROVIDER} access point`, function(done) {
            request(SERVER)
                .get(`/users/${OAUTH_PROVIDER}`)
                .expect(HTTP_FOUND)
                //.expect('location', /^https:\/\/(?!localhost)/)
                .expect('Location', /^https:\/\/localhost:(\d+)/)
                .end(done);
        });
        it(`should provide /users/${OAUTH_PROVIDER}/callback access point`, function(done) {
            request(SERVER)
                .get(`/users/${OAUTH_PROVIDER}/callback`)
                .expect(HTTP_FOUND)
                //.expect('location', /^https:\/\/(?!localhost)/)
                .expect('location', /^https:\/\/localhost:(\d+)/)
                .end(done);
        });
    });
});


/*
 * Week 4 -- Exercice 1 tests
 */
describe('Week 4 - exercice 1', function(){
    this.timeout(TIMEOUT);

    beforeEach(function(done){
        /* Nice trick to run several concurent actions and wait for them */
        var rdv = rendezVous(3, done);

        Promotions.remove({}, function(err, res) { // don't use drop() as this will occasionnnaly raise a background operation error
            if (err) console.log(err);
            Promotions.insertMany(promotions_fixture, rdv);
        });
        Dishes.remove({}, function(err, res) { // don't use drop() as this will occasionnnaly raise a background operation error
            if (err) console.log(err);
            Dishes.insertMany(dishes_fixture, rdv);
        });

        /* moved beforeEach as some test cases thins week alter the User collection */
        /* a better solution would have been to factor that out in a different */
        /* test suite -- but for sake of simplicity, I've grouped things by exercise... */
        User.remove({}, function(err, res) { // don't use drop() as this will occasionnnaly raise a background operation error
            if (err) console.log(err);
            User.insertMany(users_fixture, rdv);
        });
    });

    describe('User', function(){
        it('can return their full name', function(done) {
            var user = new User({
                username: "jogesh",
                password: "Sesame^open",
                firstname: "Jogesh",
                lastname: "Muppala",
            });

            assert.equal(user.getName(), "Jogesh Muppala");
            done();
        });

        it('will return the first name a full name if there is no last name', function(done) {
            var user = new User({
                username: "jogesh",
                password: "Sesame^open",
                firstname: "Jogesh",
            });

            assert.equal(user.getName().trim(), "Jogesh");
            done();
        });

        it('will return the last name a full name if there is no first name', function(done) {
            var user = new User({
                username: "jogesh",
                password: "Sesame^open",
                lastname: "Muppala",
            });

            assert.equal(user.getName().trim(), "Muppala");
            done();
        });

        it('may have first and last name set', function(done) {
            login("admin", "password", function(auth_res) {
                var user = {
                    username: "jogesh",
                    password: "Sesame^open",
                    firstname: "Jogesh",
                    lastname: "Muppala",
                };
                request(SERVER)
                    .post('/users/register')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .send(user)
                    .expect(HTTP_CREATED)
                    .end(function() {
                        User.find({username:user.username}, function(err, found) {
                            assert.ok(found);
                            assert.strictEqual(found.length, 1);
                            assert.strictEqual(found[0].username, user.username);
                            assert.strictEqual(found[0].firstname, user.firstname);
                            assert.strictEqual(found[0].lastname, user.lastname);
                            assert.strictEqual(found[0].admin, false);

                            done();
                        })

                    });
            });
        });

        it('have a default first name', function(done) {
            login("admin", "password", function(auth_res) {
                var user = {
                    username: "jogesh",
                    password: "Sesame^open",
                    lastname: "Muppala",
                };
                request(SERVER)
                    .post('/users/register')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .send(user)
                    .expect(HTTP_CREATED)
                    .end(function() {
                        User.find({username:user.username}, function(err, found) {
                            assert.ok(found);
                            assert.strictEqual(found.length, 1);
                            assert.strictEqual(found[0].username, user.username);
                            assert.strictEqual(found[0].firstname, '');
                            assert.strictEqual(found[0].lastname, user.lastname);
                            assert.strictEqual(found[0].admin, false);

                            done();
                        })
                    });
            });
        });

        it('have a default last name', function(done) {
            login("admin", "password", function(auth_res) {
                var user = {
                    username: "jogesh3",
                    password: "Sesame^open",
                    firstname: "Jogesh",
                };
                request(SERVER)
                    .post('/users/register')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .send(user)
                    .expect(HTTP_CREATED)
                    .end(function() {
                        User.find({username:user.username}, function(err, found) {
                            assert.ok(found);
                            assert.strictEqual(found.length, 1);
                            assert.strictEqual(found[0].username, user.username);
                            assert.strictEqual(found[0].firstname, user.firstname);
                            assert.strictEqual(found[0].lastname, '');
                            assert.strictEqual(found[0].admin, false);

                            done();
                        })
                    });
            });
        });

        it('is allowed to log in after creation', function(done) {
            login("admin", "password", function(auth_res) {
                var user = {
                    username: "jogesh2",
                    password: "Sesame^open",
                    firstname: "Jogesh",
                };
                request(SERVER)
                    .post('/users/register')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .send(user)
                    .expect(HTTP_CREATED)
                    .end(function() {
                        login(user.username, user.password, function(user_res) {
                            assert.ok(user_res);
                            assert.ok(user_res.body);
                            // console.log(user_res);
                            assert.ok(user_res.body.status);
                            assert.ok(user_res.body.token);
                            Verify.verifyOrdinaryUser(user_res, undefined, function(err) {
                                //console.log(user_res);
                                assert.ok(!err);
                                assert.strictEqual(user_res.decoded._doc.username, user.username);
                                assert.strictEqual(user_res.decoded._doc.admin, false);

                                done();
                            });
                        });
                    });
            });
        });


    });

    describe('GET /dishes', function(){
        it('should populate comment authors for all dishes', function(done) {
            login("sylvain", "password", function(auth_res) {
                request(SERVER)
                    .get('/dishes')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        for(var dish of res.body) {
                            for(var comment of dish.comments) {
                                /* should be an object (incl. "null") */
                                assert.equal(typeof comment.postedBy, 'object');
                                if (comment.postedBy) {
                                    assert.notEqual(typeof comment.postedBy._id, "undefined");
                                    assert.notEqual(typeof comment.postedBy.username, "undefined");
                                    assert.notEqual(typeof comment.postedBy.firstname, "undefined");
                                    assert.notEqual(typeof comment.postedBy.lastname, "undefined");
                                    assert.notEqual(typeof comment.postedBy.admin, "undefined");
                                }
                            }
                        }
                    })
                    .end(done);
            });
        });
    });

    describe('GET /dishes/:id', function(){
        it('should populate comment author', function(done) {
            login("sylvain", "password", function(auth_res) {
                request(SERVER)
                    .get('/dishes/000000000000000000001200')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        var comment = res.body.comments[0];
                        var user = users_fixture[0]; // hard coded for the test

                        assert.equal(comment.postedBy._id, user._id);
                        assert.equal(comment.postedBy.username, user.username);
                        assert.equal(comment.postedBy.firstname, user.firstname);
                        assert.equal(comment.postedBy.lastname, user.lastname);
                        assert.equal(comment.postedBy.admin, user.admin);
                    })
                    .end(done);
            });
        });

        it('should be set to null for non-existant users', function(done) {
            login("sylvain", "password", function(auth_res) {
                console.log(SERVER);
                request(SERVER)
                    .get('/dishes/000000000000000000001200')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        var comment = res.body.comments[1];
                        assert.strictEqual(comment.postedBy, null);
                    })
                    .end(done);
            });
        });
    });

    describe('GET /dishes/:id/comments', function(){
        it('should return all comments with populated authors', function(done) {
            login("sylvain", "password", function(auth_res) {
                request(SERVER)
                    .get('/dishes/000000000000000000001200/comments')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        var comments = res.body;
                        assert.notEqual(comments.length, 0); // ensure we have at least one comment in our test case
                        for(var comment of comments) {
                            /* should be an object (incl. "null") */
                            assert.equal(typeof comment.postedBy, 'object');
                            if (comment.postedBy) {
                                assert.notEqual(typeof comment.postedBy._id, "undefined");
                                assert.notEqual(typeof comment.postedBy.username, "undefined");
                                assert.notEqual(typeof comment.postedBy.firstname, "undefined");
                                assert.notEqual(typeof comment.postedBy.lastname, "undefined");
                                assert.notEqual(typeof comment.postedBy.admin, "undefined");
                            }
                        }
                    })
                    .end(done);
            });
        });

    });

    describe('GET /dishes/:id/comments/:id', function(){
        it('should populate comment author', function(done) {
            login("sylvain", "password", function(auth_res) {
                request(SERVER)
                    .get('/dishes/000000000000000000001300/comments/000000000000000000001302')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        var comment = res.body;
                        // Hard coded values for the test
                        assert.strictEqual(comment.postedBy._id, "56f856c56ef091173981d864");
                        assert.strictEqual(comment.postedBy.username, "sonia");
                        assert.strictEqual(comment.postedBy.firstname, "Sonia");
                        assert.strictEqual(comment.postedBy.lastname, "");
                        assert.strictEqual(comment.postedBy.admin, false);
                    })
                    .end(done);
            });
        });

    });

    describe('POST /dishes/:id/comments', function(){
        it('should store the logged user as author', function(done) {
            login("sylvain", "password", function(auth_res) {
                var new_comment = {
                    rating: 3,
                    comment: "Good dish",
                };
                request(SERVER)
                    .post('/dishes/000000000000000000001300/comments')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .send(new_comment)
                    .expect(HTTP_CREATED)
                    .expect(function(res) {
                        assert.equal(res.body.comments.length, dishes_fixture[2].comments.length+1);
                        var comment = res.body.comments[res.body.comments.length-1];

                        assert.strictEqual(comment.postedBy, "56f856c56ef091173981d865");
                        assert.strictEqual(comment.rating, new_comment.rating);
                        assert.strictEqual(comment.comment, new_comment.comment);
                    })
                    .end(done);
            });
        });
    });

    describe('PUT /dishes/:id/comments/:id', function(){
        it('should update the author', function(done) {
            login("admin", "password", function(auth_res) {
                var new_comment = {
                    rating: 3,
                    comment: "Good dish",
                };
                request(SERVER)
                    .put('/dishes/000000000000000000001300/comments/000000000000000000001301')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .send(new_comment)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.equal(res.body.comments.length, dishes_fixture[2].comments.length);
                        var comment = res.body.comments[res.body.comments.length-1];

                        assert.strictEqual(comment.postedBy, "56f856cf6ef091173981d866");
                        assert.strictEqual(comment.rating, new_comment.rating);
                        assert.strictEqual(comment.comment, new_comment.comment);
                    })
                    .end(done);
            });
        });
    });


    describe('DELETE /dishes/:id/comments/:id', function(){
        it('is authorized when the user is the author', function(done) {
            login("sylvain", "password", function(auth_res) {
                var new_comment = {
                    rating: 3,
                    comment: "Good dish",
                };
                request(SERVER)
                    .delete('/dishes/000000000000000000001300/comments/000000000000000000001301')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.equal(res.body.comments.length, dishes_fixture[2].comments.length-1);
                        assert.equal(res.body.comments.find(function(item) { item.postedBy === dishes_fixture[2].comments[0]._id}), undefined);
                    })
                    .end(done);
            });
        });
        it('is forbidden when the user is the author', function(done) {
            login("sylvain", "password", function(auth_res) {
                var new_comment = {
                    rating: 3,
                    comment: "Good dish",
                };
                request(SERVER)
                    .delete('/dishes/000000000000000000001300/comments/000000000000000000001302')
                    .set('Accept', 'application/json')
                    .set('x-access-token', auth_res.body.token)
                    .expect(HTTP_FORBIDDEN)
                    .end(done);
            });
        });
    });


});



/*
 * Assignment 3 tests
 */
describe('Verify permission', function(){
    this.timeout(TIMEOUT);

    before(function(done) {
        User.remove({}, function(err, res) { // don't use drop() as this will occasionnnaly raise a background operation error
            User.insertMany(users_fixture, done);
        });
    });

    beforeEach(function(done){
        Promotions.remove({}, function(err, res) { // don't use drop() as this will occasionnnaly raise a background operation error
            Promotions.insertMany(promotions_fixture, done);
        });
    });

    describe('GET /users', function(){
        it('returns all users when authenticated as admin', function(done){
            login("admin", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .get('/users')
                    .set('x-access-token', token)
                    //.expect(console.log)
                    .expect('Content-Type', /json/)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        // hash & salt are hidden in the result set
                        var expected = users_fixture.map(function (item) {
                            /* Ugly clone ? */
                            var copy = JSON.parse(JSON.stringify(item));

                            delete copy.hash;
                            delete copy.salt;
                            return copy;
                        });

                        assert.deepEqual(res.body, expected);
                    })
                    .end(done);
            });
        });

        it('is forbidden when authenticated as normal user', function(done){
            login("sylvain", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .get('/users')
                    .set('x-access-token', token)
                    .expect(HTTP_FORBIDDEN)
                    .expect(/You are not authorized to perform this operation!/) // required by assignment 3 task 3
                    .expect(function(res) {
                        assert.deepEqual(res.body, {});
                    })
                    .end(done);
            });
        });

        it('returns "unauthorized" when not properly authenticated', function(done){
            request(SERVER)
                .get('/promotions')
                .expect(HTTP_UNAUTHORIZED)
                .expect(function(res) {
                    assert.deepEqual(res.body, {});
                })
                .end(done);
        });

    });


    describe('GET /promotions', function(){
        it('returns all promotions when authenticated', function(done){
            login("sylvain", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .get('/promotions')
                    .set('x-access-token', token)
                    .expect('Content-Type', /json/)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.deepEqual(res.body, promotions_fixture);
                    })
                    .end(done);
            });
        });

        it('returns "unauthorized" when not properly authenticated', function(done){
            request(SERVER)
                .get('/promotions')
                .expect(HTTP_UNAUTHORIZED)
                .end(done);
        });


    });

    describe('POST /promotions', function(){
        it('post a dish when authenticated as admin', function(done){
            login("admin", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .post('/promotions')
                    .set('x-access-token', token)
                    .send(new_promotion)
                    //.expect(console.log)
                    .expect('Content-Type', /json/)
                    .expect(HTTP_CREATED)
                    .expect(function(res) {
                        assert.ok(res.body._id);
                        assert.equal(res.body.name, new_promotion.name);
                        assert.equal(res.body.image, new_promotion.image);
                        assert.equal(res.body.label, new_promotion.label);
                        assert.equal(res.body.price, new_promotion.price);
                        assert.equal(res.body.description, new_promotion.description);
                    })
                    .end(done);
            });
        });

        it('is forbidden when authenticated as normal user', function(done){
            login("sylvain", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .post('/promotions')
                    .set('x-access-token', token)
                    .expect(HTTP_FORBIDDEN)
                    .expect(function(res) {
                        assert.deepEqual(res.body, {});
                    })
                    .end(done);
            });
        });

        it('returns "unauthorized" when not properly authenticated', function(done){
            request(SERVER)
                .post('/promotions')
                .expect(HTTP_UNAUTHORIZED)
                .expect(function(res) {
                    assert.deepEqual(res.body, {});
                })
                .end(done);
        });

    });


    describe('DELETE /promotions', function(){
        it('delete all dishes when authenticated as admin', function(done){
            login("admin", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .delete('/promotions')
                    .set('x-access-token', token)
                    .send(new_promotion)
                    //.expect(console.log)
                    .expect(function(res) {
                        assert.deepEqual(res.body, { ok: 1, n: promotions_fixture.length });
                    })
                    .end(done);
            });
        });

        it('is forbidden when authenticated as normal user', function(done){
            login("sylvain", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .delete('/promotions')
                    .set('x-access-token', token)
                    .expect(HTTP_FORBIDDEN)
                    .end(done);
            });
        });

        it('returns "unauthorized" when not properly authenticated', function(done){
            request(SERVER)
                .delete('/promotions')
                .expect(HTTP_UNAUTHORIZED)
                .end(done);
        });

    });

    describe('GET /promotions/:id', function(){
        it('returns a promotions when authenticated', function(done){
            login("sylvain", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .get('/promotions/' + promotions_fixture[0]._id)
                    .set('x-access-token', token)
                    .expect('Content-Type', /json/)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.deepEqual(res.body, promotions_fixture[0]);
                    })
                    .end(done);
            });
        });

        it('returns "unauthorized" when not properly authenticated', function(done){
            request(SERVER)
                .get('/promotions/' + promotions_fixture[0]._id)
                .expect(HTTP_UNAUTHORIZED)
                .end(done);
        });

    });

    describe('PUT /promotions/:id', function(){
        it('change a promotions when authenticated as admin', function(done){
            login("admin", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .put('/promotions/' + promotions_fixture[0]._id)
                    .send(new_promotion)
                    .set('x-access-token', token)
                    .expect('Content-Type', /json/)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.equal(res.body._id, promotions_fixture[0]._id);
                        assert.equal(res.body.name, new_promotion.name);
                        assert.equal(res.body.image, new_promotion.image);
                        assert.equal(res.body.label, new_promotion.label);
                        assert.equal(res.body.price, new_promotion.price);
                        assert.equal(res.body.description, new_promotion.description);
                    })
                    .end(done);
            });
        });

        it('is forbidden when authenticated as normal user', function(done){
            login("sylvain", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .put('/promotions/' + promotions_fixture[0]._id)
                    .send(new_promotion)
                    .set('x-access-token', token)
                    .expect(HTTP_FORBIDDEN)
                    .end(done);
            });
        });

        it('returns "unauthorized" when not properly authenticated', function(done){
            request(SERVER)
                .put('/promotions/' + promotions_fixture[0]._id)
                .expect(HTTP_UNAUTHORIZED)
                .end(done);
        });

    });

    describe('DELETE /promotions/:id', function(){
        it('remove a promotions when authenticated as admin', function(done){
            login("admin", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .delete('/promotions/' + promotions_fixture[0]._id)
                    .set('x-access-token', token)
                    .expect('Content-Type', /json/)
                    .expect(HTTP_OK)
                    .expect(function(res) {
                        assert.equal(res.body._id, promotions_fixture[0]._id);
                        assert.equal(res.body.name, promotions_fixture[0].name);
                        assert.equal(res.body.image, promotions_fixture[0].image);
                        assert.equal(res.body.label, promotions_fixture[0].label);
                        assert.equal(res.body.price, promotions_fixture[0].price);
                        assert.equal(res.body.description, promotions_fixture[0].description);
                    })
                    .end(done);
            });
        });

        it('returns 403 when authenticated as normal user', function(done){
            login("sylvain", "password", function(auth_res) {
                var token = auth_res.body.token;
                request(SERVER)
                    .delete('/promotions/' + promotions_fixture[0]._id)
                    .set('x-access-token', token)
                    .expect(HTTP_FORBIDDEN)
                    .end(done);
            });
        });

        it('returns "unauthorized" when not properly authenticated', function(done){
            request(SERVER)
                .delete('/promotions/' + promotions_fixture[0]._id)
                .expect(HTTP_UNAUTHORIZED)
                .end(done);
        });

    });

});