{
    "_id": "_design/microblog",
    
    "views": {
      
        "users_search": {
            "map": "function(doc){
                if(doc._id && doc.type === 'user') {
                    emit(doc._id,doc);
                }
            }"
        },
        
        "users_by_id": {
            "map": "function(doc){
                if(doc._id && doc.type === 'user') {
                    emit(doc._id,doc);
                }
            }"
        },
        
        "posts_all": {
            "map": "function(doc) {
                if(doc._id && doc.type === 'post') {
                    emit(doc.dateCreated.split('-'),doc);
                }
            }"
        },
        
        "posts_by_id": {
            "map": "function(doc) {
                if(doc._id && doc.type === 'post') {
                    emit(doc._id,doc);
                }
            }"            
        },
        
        "posts_by_user": {
            "map": "function(doc) {
                if(doc._id && doc.type === 'post') {
                    emit(doc.user,doc);
                }
            }"            
        },
        
        "posts_search": {
            "map": "function(doc) {
                if(doc._id && doc.type === 'post') {
                    emit(doc.user,doc);
                }
            }"            
        },
        
        "posts_by_user": {
            "map": "function(doc) {
                if(doc.user && doc.type === 'post') {
                    emit(doc.dateCreated.split('-').concat(doc.user),doc);
                }
            }"            
        },
        
        "follows_user_is_following" : {
            "map" : "function(doc) {
                if(doc.user && doc.type==='follow') {
                    emit(doc.user, {_id:doc.follows});
                }
            }"
        },
        "follows_is_following_user" : {
            "map" : "function(doc) {
                if(doc.follows && doc.type==='follow') {
                    emit(doc.follows, {_id:doc.user});
                }
            }"
        }
    },
    
    "validate_doc_update": "function(newDoc, oldDoc, userCtx) {
        function require(field,message) {
            message = message || field + ' is required';
            if (!newDoc[field]) {
                throw({forbidden: message});
            }
        };
        
        function unchanged(field) {
            if(oldDoc && toJSON(oldDoc[field]) !== toJSON(newDoc[field])) {
                throw({forbidden : field + ' is read-only'});
            }
        };
        
        if(newDoc._deleted) {
            return true;
        } else {
            switch(newDoc.type) {
                case 'user':
                    require('name');
                    require('email');
                    require('password');
                    break;
                case 'post':
                    require('text');
                    require('user');
                    require('dateCreated');
                    unchanged('dateCreated');
                    break;
                case 'follow':
                    require('user');
                    require('follows');
                    break;
            }
        }
    }"
}