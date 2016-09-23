'use strict';

console.log('Loading function');

var aws = require('aws-sdk');
var vision = require('node-cloud-vision-api');

var s3 = new aws.S3({apiVersion: '2006-03-01'});

vision.init({auth: 'AIzaSyCMHDy3VglnLi72j-MYxFvQB413deiZDZw'});


var vision = require('@google-cloud/vision')({
    projectId: 'dynamic-yield-exercise',
    credentials: {
        client_email: 'sbd.580@gmail.com',
        private_key: 'AIzaSyCMHDy3VglnLi72j-MYxFvQB413deiZDZw'
    }
});

exports.handler = function(event, context, callback){
    // console.log('Received event:', JSON.stringify(event, null, 2));

    var bucket = event.Records[0].s3.bucket.name;
    var key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    console.log('New object: bucket - '+bucket+', key - '+key);

    s3.getObject({
        Bucket: bucket,
        Key: key,
    }, function(err, data){
        if (err) {
            console.error(err);
            return callback(message);
        }

        vision.annotate(new vision.Request({
            image: new vision.Image({base64: data.toString('base64')}),
            features: [
                new vision.Feature('LABEL_DETECTION', 100),
            ]
        })).then(function(res){
            console.log(res);
            callback(res);
        },function(err){
            console.error(err);
            callback(err);
        });
    });
};