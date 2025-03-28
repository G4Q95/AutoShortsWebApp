/**
 * R2 File Deletion Worker
 * 
 * This Worker handles deletion of files from Cloudflare R2 storage.
 * It accepts an array of object keys and deletes them from the specified bucket.
 */

// Main Worker handler
export default {
  /**
   * Handle incoming requests to the Worker
   * 
   * @param {Request} request - The incoming request
   * @param {Object} env - Environment bindings including R2 bucket
   * @returns {Response} JSON response with deletion results
   */
  async fetch(request, env) {
    // Only accept POST requests
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
      });
    }

    try {
      // Parse the request body
      const { objectKeys } = await request.json();
      
      // Validate input
      if (!objectKeys || !Array.isArray(objectKeys) || objectKeys.length === 0) {
        return new Response(JSON.stringify({ error: "Invalid input: objectKeys must be a non-empty array" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      console.log(`Deleting ${objectKeys.length} objects from R2`);
      
      // Delete the objects from R2
      const results = await Promise.all(
        objectKeys.map(async (key) => {
          try {
            await env.AUTO_SHORTS_BUCKET.delete(key);
            return { key, success: true };
          } catch (error) {
            console.error(`Error deleting ${key}: ${error.message}`);
            return { 
              key, 
              success: false, 
              error: error.message 
            };
          }
        })
      );
      
      // Count successes and failures
      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;
      
      // Return the results
      return new Response(JSON.stringify({ 
        total: results.length,
        successful,
        failed,
        results 
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      // Handle general errors
      console.error(`Worker error: ${error.message}`);
      return new Response(JSON.stringify({ 
        error: "Worker error", 
        message: error.message 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
}; 