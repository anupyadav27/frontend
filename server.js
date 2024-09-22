const express = require('express');
const neo4j = require('neo4j-driver');
const cors = require('cors');

// Initialize Express app
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.static('public')); // Serve static files from 'public' directory

// Set Neo4j connection details
const neo4jUri = process.env.NEO4J_URI;
const neo4jUser = process.env.NEO4J_USER;
const neo4jPassword = process.env.NEO4J_PASSWORD;

// Ensure environment variables are set
if (!neo4jUri || !neo4jUser || !neo4jPassword) {
  console.error('Neo4j connection details are missing!');
  process.exit(1); // Exit if details are not set
}

// Initialize Neo4j driver
let driver;
try {
  driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
  console.log('Successfully connected to Neo4j');
} catch (error) {
  console.error('Failed to connect to Neo4j:', error);
  process.exit(1);
}

// Route to fetch graph data from Neo4j, including all nodes (even without relationships)
app.get('/api/graph-data', async (req, res) => {
  const session = driver.session();
  try {
    // Modified query to fetch all nodes and optional relationships
    const result = await session.run(`
      MATCH (n)
      OPTIONAL MATCH (n)-[r]->(m)
      RETURN n, r, m LIMIT 100
    `);

    const nodesMap = new Map();
    const links = [];

    result.records.forEach(record => {
      const node1 = record.get('n');

      // Use Neo4j's internal node ID if no 'id' property is available
      const node1Id = node1.identity.toString(); // Neo4j internal ID
      const node1Label = node1.properties.name || 'Unnamed Node'; // Fallback if no 'name' property

      // Add node1 if it's not already in the map
      if (!nodesMap.has(node1Id)) {
        nodesMap.set(node1Id, { id: node1Id, label: node1Label });
      }

      if (record.get('m')) { // Check if there is a second node and relationship
        const node2 = record.get('m');
        const node2Id = node2.identity.toString(); // Neo4j internal ID
        const node2Label = node2.properties.name || 'Unnamed Node';

        // Add node2 if it's not already in the map
        if (!nodesMap.has(node2Id)) {
          nodesMap.set(node2Id, { id: node2Id, label: node2Label });
        }

        const relationship = record.get('r').type;
        
        // Add the relationship link
        links.push({ source: node1Id, target: node2Id, type: relationship });
      }
    });

    // Convert map to array for the nodes
    const nodes = Array.from(nodesMap.values());

    // Send the graph data as JSON
    res.json({ nodes, links });
  } catch (error) {
    console.error('Error fetching graph data:', error);
    res.status(500).json({ error: 'An error occurred while fetching graph data' });
  } finally {
    await session.close();
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
});
