const gremlin = require('gremlin');
// const { query } = require('./client');

const traversal = gremlin.process.AnonymousTraversalSource.traversal;
const DriverRemoteConnection = gremlin.driver.DriverRemoteConnection;

(async () => {
  // const connection = new DriverRemoteConnection('ws://localhost:8182/gremlin')
  // try {
  //   const g = traversal().withRemote(connection);

  //   g.V().hasLabel('person').values('name').toList()
  //     .then(names => console.log(names));
    
  //   const names = await g.V().hasLabel('person').values('name').toList();
  //   console.log(names);
  // }
  // finally {
  //   connection.close();
  // }
  // query().then(() => {
  //   console.log('done');
  // });
  require('./client');
})();