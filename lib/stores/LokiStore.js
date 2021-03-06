/**
 * @module LokiStore
 */
var loki = require('lokijs');
var _ = require("underscore");

/**
 * @class LowkeySource
 * @description Manages Loki datasource
 */
class LowkeySource {

  constructor() {
    this.dataSource = null;
    this.resources = {};
  }

  /**
   * Initializes and returns a datasource
   * @return {loki} loki datasource
   */
  getDS() {
    if (this.dataSource) {
      return this.dataSource;
    }
    this.dataSource = new loki();
    return this.dataSource;
  }

  /**
   * Initializes and returns a resource
   * @param  {string} name name of resource
   * @return {object}      Loki Collection
   */
  getResource(name) {
    var resources = this.resources;
    if (resources[name]) {
      return resources[name];
    }

    var resource = this.getDS().addCollection(name);
    resources[name] = resource;

    return resource;
  }
}

var $ds = new LowkeySource();

/**
 * Generate Store
 * @param  {name} name name of resource
 * @return {object} Loki store template
 */
function generateStore(options) {
  var { name, idAttr, fk } = options;
  var collection = $ds.getResource(name);
  return {
    name: name,
    collection: collection,
    dynamicViews: {},

    /**
     * Initializes store
     */
    init() {
    },

    /**
     * Adds an object to the store
     * @param {object} object Object to add
     * @return {event} Triggers event
     */
    add(object, trigger=true) {
      var stale = this.getDatabaseEntity(object);
      if (stale) {
        console.warn("ProcoreReact: Trying to add an already existing element.");
      } else {
        this.collection.insert(object);
        this.trigger("add", object, trigger);
      }
    },

    /**
     * Sets collection
     * @param {array} collection Collection to set
     * @return {event} Triggers event
     */
    setCollection(collection) {
      _.map(collection, (object) => {
        var stale = this.getDatabaseEntity(object);
        if (stale) {
          this.collection.update(_.extend(stale, object));
        }else{
          this.collection.insert(object);
        }
      });
      this.trigger("setCollection", this.getCollection());
    },

    /**
     * Set object without triggering events
     * @param {object} object Object to insert or update
     */
    setObject(object) {
      var stale = this.getDatabaseEntity(object);
      if (stale) {
        this.update(object, false);
      }else{
        this.add(object, false);
      }
    },

    /**
     * Destroys object
     * @param  {number} id ID of object to destroy
     * @return {event} Triggers event
     */
    destroy(id, trigger=true) {
      this.collection.remove(this.get(id));
      this.trigger("destroy", id, trigger);
    },

    /**
     * Destroys all objects in the store
     * @return {event} Triggers event
     */
    destroyAll(trigger=true) {
      this.collection.removeDataOnly();
      this.trigger("destroyAll", this.getCollection(), trigger);
    },

    /**
     * Updates an object in the store
     * @param  {object} object Object to update
     * @return {event} Triggers an event
     */
    update(updates, trigger=true) {
      var stale = this.getDatabaseEntity(updates);
      if (!stale) {
        console.warn("ProcoreReact: Trying to update an inexisting element.");
      }else{
        let updated = _.extend({}, stale, updates);
        this.collection.update(updated);
        this.trigger("update", updated, trigger);
      }
    },

    /**
     * Builds a query to fetch an object
     * @param  {number} object.id ID of requested object
     * @param {number} object.$loki LokiID of the requested object
     * @return {object} Requested object
     */
    getEntityQuery(object) {
      var query = {};
      if (object.$loki) {
        query.$loki = object.$loki;
      } else if (object.id) {
        query[idAttr] = object.id;
      } else {
        query = null;
      }
      return query;
    },

    /**
     * Gets an object's equivalent from dataSource
     * @param  {number} id ID of requested object
     * @return {object} Requested object
     */
    getDatabaseEntity(object) {
      var query = this.getEntityQuery(object);
      return query ? this.collection.findOne(query) : null;
    },

    /**
     * Gets an object by ID
     * @param  {number} id ID of object to get
     * @return {object} Requested object
     */
    get(id) {
      return this.getDatabaseEntity( {id: id} );
    },

    /**
     * Queries store
     * @param  {object} query mongo-style query
     * @return {array} Array of reuslts
     */
    find(query) {
      return this.collection.find(query);
    },

    /**
     * Gets collection of objects
     * @param  {number} parentId ParentID of objects, for relational data (optional)
     * @return {array} Collection of objects
     */
    getCollection(tag) {
      var collection = [];
      if (tag) {
        var view = this.collection.getDynamicView(tag);
        collection = view ? view.data() : [];
      } else {
        collection = this.find();
      }
      return collection;
    },


    /**
     * Creates a filter
     * @param {string} tag Tag of Collection to be filtered
     * @param {object} filterQuery filter query
     * @return {event} Triggers event
     */
    filter(tag, filterQuery) {
      if (!this.dynamicViews[tag]) {
        this.dynamicViews[tag] = { filters: {}, sortBy: {}, search: "" };
      }
      this.collection.removeDynamicView(tag);

      var viewParams = this.dynamicViews[tag];
      _.extend(viewParams.filters, filterQuery);
      this.registerView(tag, viewParams);

    },

    /**
     * Creates a search
     * @param {string} tag Tag of Collection to be searched
     * @param {object} searchQuery search query
     * @return {event} Triggers event
     */
    search(tag, searchQuery) {
      if (!this.dynamicViews[tag]) {
        this.dynamicViews[tag] = { filters: {}, sortBy: {}, search: "" };
      }
      this.collection.removeDynamicView(tag);

      var viewParams = this.dynamicViews[tag];
      viewParams.search = searchQuery;

      this.registerView(tag, viewParams);

    },

    /**
     * Adds a sort parameter
     * @param {string} tag Tag of Collection to be filtered
     * @param {object} sortParam sort parameter
     */
    sort(tag, sortBy) {
      if (!this.dynamicViews[tag]) {
        this.dynamicViews[tag] = { filters: {}, sortBy: {}, search: "" };
      }
      this.collection.removeDynamicView(tag);

      var viewParams = this.dynamicViews[tag];
      viewParams.sortBy = sortBy;
      this.registerView(tag, viewParams);
    },

    /**
     * Removes filter and sort parameters from view
     * @param {string} tag Tag of Collection to be reset
     */
    resetView(tag, reregister) {
      this.collection.removeDynamicView(tag);
      if (reregister !== false) { this.registerView(tag); }
    },

    /**
     * Generates new dynamic view
     * @param {string} tag Tag of Collection to be filtered
     * @param {object} sort and filter parameters
     * @return {event} Triggers event
     */
    registerView(tag, viewParams) {
      this.collection.removeDynamicView(tag);
      var view = this.collection.addDynamicView(tag);
      if (!viewParams) { return this.trigger("viewRegistered", tag); }

      var { filters, sortBy, search } = viewParams;
      sortBy && view.applySimpleSort(sortBy.attribute, sortBy.isDescending);
      filters && _applyViewFilters(view, filters);
      search && view.applyWhere(_buildSearch(search));


      this.trigger("viewRegistered", tag);
    }
  };
}


function _buildSearch(query) {
  return function(object) {
    var match = false;
    Object.keys(object).forEach((key) => {
      if (!match) {
        match = JSON.stringify(object[key])
        .toLowerCase()
        .indexOf(query.toLowerCase()) !== -1;
      }
    });
    return match;
  };
}

function _applyViewFilters(view, filters) {
  Object.keys(filters).forEach((key) => {
    var query = null;
    switch(filters[key]) {
      case undefined:
        break;
      case null:
        break;
      default:
        query = {};
        query[key] = filters[key];
        break;
    }
    query && view.applyFind(query);
  });
}

module.exports = generateStore;
