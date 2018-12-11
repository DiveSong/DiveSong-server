async function getPath(id)
{
	return new Promise(function(resolve, reject) {
        // The Promise constructor should catch any errors thrown on
        // this tick. Alternately, try/catch and reject(err) on catch.
        var connection = getMySQL_connection();

        var query_str =
        "SELECT tpath " +
        "FROM track " +
        "WHERE (id = ?) " +
        "LIMIT 1 ";

        var query_var = [id];

        connection.query(query_str, query_var, function (err, rows, fields) {
            // Call reject on error states,
            // call resolve with results
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
    });
}
