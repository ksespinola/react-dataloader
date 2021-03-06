function getPath() {
  return Procore && Procore.Environment && Procore.Environment.checklistRoot || "";
}

function procoreUrlBuilder(options) {
  var { fkAttr, parentResource, rootResource, fkRootAttr, resource } = options;
  var postFix = '.json';
  return {
  /**
   * Generate resource URL
   * @param { object } object Object being operated upon
   * @return {string} resource API endpoint url
   */
    _getResourceUrl(object) {
      var url;
      if (!object) {
        url = `${getPath()}/${this.endpoint}`;
      }else if (object.rootId) {
        url = `${getPath()}/${rootResource}/${object.rootId}/${this.endpoint}`;
      } else if (!parentResource) {
        if (object[fkAttr]) {
          url = `${getPath()}/${this.endpoint}/${object[fkAttr]}`;
        } else if (object.loadId) { 
          url = `${getPath()}/${this.endpoint}/${object.loadId}`;
        } else { 
          url = `${getPath()}/${this.endpoint}`;
        }
      } else {
        url = `${getPath()}/${parentResource}/${object[fkAttr]}/${this.endpoint}`;
      }
      return `${url}${postFix}`;
    },

  /**
   * Generate single resource URL
   * @param  {number} id ID of resource
   * @return {string} resource API url
   */
    _getObjectUrl(id) {
      return `${getPath()}/${this.endpoint}/${id}${postFix}`;
    },

    _serialize(object) {
      var data = {};
      if (resource) {
        data[resource] = object;
      } else {
        data = object;
      }
      return data;
    }

  };
}

module.exports = procoreUrlBuilder;
