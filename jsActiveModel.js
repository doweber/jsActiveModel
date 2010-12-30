(function($){
    var methods = {
      init : function(options){
      },
      
      db_setup : function(){
        //check if the client supports storage
        if(window.openDatabase){
          db = openDatabase(DATABASE, DBVERSION, DBDESCRIPTION, DBSIZE);
          db.transaction(
              function (transaction) {
                DBCOLUMNS = 'id, ' + DBCOLUMNS + ', local_storage_id'; 
                transaction.executeSql('CREATE TABLE IF NOT EXISTS ' + DBTABLE + ' (' + DBCOLUMNS + ')');
                transaction.executeSql('CREATE TABLE IF NOT EXISTS ' + DBTABLE + '_AUDIT (' + DBCOLUMNS + ')');
              }
          );
        }else{
          alert("device does not support localStorage. continue with sync.");
          if(IS_SYNCABLE){
            methods.sync(url);
          }else{
            alert('syncing is disabled for this model also. no data will be saved anywhere... ever.... perhaps just in ram for now. if you close the app the data goes bye bye.');
          }
        }

      },//end db_setup

      auto_increment_key : function(){
        function dataHandler(transaction, results)
        {
            // Handle the results
            for (var i=0; i<results.rows.length; i++) {
                // Each row is a standard JavaScript array indexed by
                // column names.
                var row = results.rows.item(i);
                last_local_id = row['last_local_id'] + 1;
            }
        }
        function errorHandler(transaction, error)
        {
            // error.message is a human-readable string.
            // error.code is a numeric error code
            alert('Oops.  Error was '+error.message+' (Code '+error.code+')');
         
            // Handle errors here
            var we_think_this_error_is_fatal = true;
            if (we_think_this_error_is_fatal) return true;
            return false;
        }
        db.transaction(
            function (transaction) {
                transaction.executeSql("SELECT MAX(local_storage_id) AS last_local_id FROM " + DBTABLE,
                    [], // array of values for the ? placeholders
                    dataHandler, errorHandler);
            }
        );

      },//end auto_increment_key

      find_last_id : function(){
        //get the last id so it can be used as a marker during sync
        function dataHandler(transaction, results)
        {
            // Handle the results
            for (var i=0; i<results.rows.length; i++) {
                // Each row is a standard JavaScript array indexed by
                // column names.
                var row = results.rows.item(i);
                last_id = row['last_id'] + 1;
            }
        }
        function errorHandler(transaction, error)
        {
            // error.message is a human-readable string.
            // error.code is a numeric error code
            alert('Oops.  Error was '+error.message+' (Code '+error.code+')');
         
            // Handle errors here
            var we_think_this_error_is_fatal = true;
            if (we_think_this_error_is_fatal) return true;
            return false;
        }
        db.transaction(
            function (transaction) {
                transaction.executeSql("SELECT MAX(id) AS last_id FROM " + DBTABLE,
                    [], // array of values for the ? placeholders
                    dataHandler, errorHandler);
            }
        );

      },//end find_last_id

      get_new_records : function(){
        methods.find_last_id();
        $.ajax({
            url : pull_url + '?auth_token=' + AUTH_TOKEN,
            method : 'GET',
            dataType : 'jsonp',
            error: function(request, textStatus, error) {
                if (request.status == 401) {
                    ShowLoginUI(function() {
                        data = self.Get(url);
                    });
                }
                alert('error: ' + request);
            },
            success: function(res){
              //some error catch here if the data from 

              //if there is local storage then save it, if not just return the response
              if(window.openDatabase){
                //insert new records into DB
              }else{
                alert('return stuff here: ' + res);
              }
            }
          });
      },//end get_new_records

      create : function( data, url ){
        methods.db_setup();
        methods.auto_increment_key();
        db.transaction(postit, error, success);

        //openDatabase callbacks
        function postit(jdb){
          var keys = ''; //add local_id as a default to all tables
          var values = '';

          for(var key in data) {
              keys = keys + "'" + key + "', ";
              values = values + "'" + data[key] + "', ";
          }

          keys = 'id, ' + keys + ' local_storage_id';
          values = 'null, ' + values + ' ' + last_local_id;

          jdb.executeSql('INSERT INTO ' + DBTABLE + '  (' + keys + ') VALUES (' + values + ')');
          jdb.executeSql('INSERT INTO ' + DBTABLE + '_AUDIT  (' + keys + ') VALUES (' + values + ')');
        }
        function error(jdb, err){
          alert("Error processing SQL: " + jdb.message);
        }
        function success(jdb){
          //if this model is_syncable and API is online, trigger sync method
          if(IS_SYNCABLE){
            methods.sync(url);
          }
        }  

      },//end create

      update : function(options){
      },//end update

      destroy : function(options){
      },//end destroy

      destroy_audit : function(local_id){
        //removes the record from the audit table only
        db.transaction(
          function (transaction) {
            transaction.executeSql("DELETE FROM " + DBTABLE + "_AUDIT where local_storage_id=?;", [ local_id ]); // array of values for the ? placeholders
          }
        );
      },//end destroy_audit

      sync : function(url){
        //pull new data down
        methods.get_new_records();
        //loop through the audit table and prepare the post
        function dataHandler(transaction, results)
        {
            // Handle the results
            for (var i=0; i<results.rows.length; i++) {
                // Each row is a standard JavaScript array indexed by
                // column names.
                var row = results.rows.item(i);
                alert("row: " + row['name']);
                methods.send_request(row);
            }
        }
        function errorHandler(transaction, error)
        {
            // error.message is a human-readable string.
            // error.code is a numeric error code
            alert('Oops.  Error was '+error.message+' (Code '+error.code+')');
         
            // Handle errors here
            var we_think_this_error_is_fatal = true;
            if (we_think_this_error_is_fatal) return true;
            return false;
        }
        db.transaction(
            function (transaction) {
                transaction.executeSql("SELECT * FROM " + DBTABLE + "_AUDIT;",
                    [], // array of values for the ? placeholders
                    dataHandler, errorHandler);
            }
        );
      },//end sync
      
      send_request : function(row){
        var params = 'a[name]=' + row['name'];
        var data = '&' + encodeURI(params);

        $.ajax({
            url : url + '?auth_token=' + AUTH_TOKEN + data,
            method : 'GET',
            dataType : 'jsonp',
            error: function(request, textStatus, error) {
                if (request.status == 401) {
                    ShowLoginUI(function() {
                        data = self.Get(url);
                    });
                }
                alert('error: ' + request);
            },
            success: function(res){
              //some error catch here if the data from 

              //if there is local storage then save it, if not just return the response
              if(window.openDatabase){
                methods.merge(res, row['local_storage_id']);
              }else{
                alert('return stuff here: ' + res);
              }
            }
          });
      },//end send_request

      merge : function(res, local_storage_id){
        //update the table with the ID from the server
        //update the database
        db.transaction(
          function (transaction) {
            transaction.executeSql("UPDATE " + DBTABLE + " set id=? where local_storage_id=?;", [ res.a.id, local_storage_id ]); // array of values for the ? placeholders
          }
        );
        //purge the audit table
        methods.destroy_audit(local_storage_id);
        //return some final response here
      }//end merge
    };









  $.fn.jsActiveModel = function( method, options ) {
    // Method calling logic
    if ( methods[method] ) {
      return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
    } else if ( typeof method === 'object' || ! method ) {
      return methods.init.apply( this, arguments );
    } else {
      $.error( 'Method ' +  method + ' does not exist on jsActiveModel' );
    }    
  
  };
})(jQuery);