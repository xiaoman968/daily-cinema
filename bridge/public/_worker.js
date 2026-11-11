export default {
  async fetch(request, env) {
    return env.ANALYZER.fetch(request);
  }
};
