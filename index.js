'use strict';

console.log('Loading function');

var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});

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

        vision.detectLabels(data.body,function(err,labels){
            if(err){
                console.error(err);
                return callback(err);
            }

            console.log(labels);
            callback(null, labels);
        });
    });
};