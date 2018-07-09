import PropTypes from 'prop-types';
import React, { Component } from 'react';
import Autosuggest from 'react-autosuggest';
import uuid from 'uuid/v4';
import { List, Map } from 'immutable';
import { connect } from 'react-redux';
import { debounce } from 'lodash';
import { query, clearSearch } from 'Actions/search';
import { Loader } from 'UI';

function escapeRegexCharacters(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const getField = (item, field) => {
  // Do extended field parsing if given an object.
  if (typeof(field) === "object") {

    // Handle both plain objects and .get interfaces
    const fieldType = field["type"] || field.get("type");

    // Do something different depending on the "type" given.
    switch(fieldType) {
    case "slug":
      return item.slug
    case "path":
      return item.path
    case "frontmatter":
      const fieldName = field['name'];
      if(!fieldName) {
        throw `Can't get frontmatter field without a "name" value in the field object!`;
      }
      return item.data[fieldName];
    default:
      throw `Relation field type not supported: ${fieldType}`
    }
  } else {
    // Simply pluck from frontmatter if given a string.
    return new String(item.data[field]);
  }
};

class RelationControl extends Component {
  static propTypes = {
    onChange: PropTypes.func.isRequired,
    forID: PropTypes.string.isRequired,
    value: PropTypes.node,
    field: PropTypes.node,
    isFetching: PropTypes.node,
    query: PropTypes.func.isRequired,
    clearSearch: PropTypes.func.isRequired,
    queryHits: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.object,
    ]),
    classNameWrapper: PropTypes.string.isRequired,
    setActiveStyle: PropTypes.func.isRequired,
    setInactiveStyle: PropTypes.func.isRequired,
  };

  static defaultProps = {
    value: '',
  };

  constructor(props, ctx) {
    super(props, ctx);
    this.controlID = uuid();
    this.didInitialSearch = false;
  }

  componentDidMount() {
    const { value, field } = this.props;
    if (value) {
      const collection = field.get('collection');
      const searchFields = field.get('searchFields').toJS();
      this.props.query(this.controlID, collection, searchFields, value);
    }
  }

  componentWillReceiveProps(nextProps) {
    if (this.didInitialSearch) return;
    if (nextProps.queryHits !== this.props.queryHits && nextProps.queryHits.get && nextProps.queryHits.get(this.controlID)) {
      this.didInitialSearch = true;
      const suggestion = nextProps.queryHits.get(this.controlID);
      if (suggestion && suggestion.length === 1) {
        const val = this.getSuggestionValue(suggestion[0]);
        this.props.onChange(val, { [nextProps.field.get('collection')]: { [val]: suggestion[0].data } });
      }
    }
  }

  onChange = (event, { newValue }) => {
    this.props.onChange(newValue);
  };

  onSuggestionSelected = (event, { suggestion }) => {
    const value = this.getSuggestionValue(suggestion);
    this.props.onChange(value, { [this.props.field.get('collection')]: { [value]: suggestion.data } });
  };

  onSuggestionsFetchRequested = debounce(({ value }) => {
    if (value.length < 2) return;
    const { field } = this.props;
    const collection = field.get('collection');
    const searchFields = field.get('searchFields').toJS();
    this.props.query(this.controlID, collection, searchFields, value);
  }, 500);

  onSuggestionsClearRequested = () => {
    this.props.clearSearch();
  };

  getSuggestionValue = (suggestion) => {
    const { field } = this.props;
    const valueField = field.get('valueField');
    return getField(suggestion, valueField);
  };

  renderSuggestion = (suggestion) => {
    const { field } = this.props;
    const valueField = field.get('displayFields') || field.get('valueField');
    if (List.isList(valueField)) {
      return (
        <span>
          {valueField.toJS().map(key => <span key={key}>{new String(getField(suggestion,key))}{' '}</span>)}
        </span>
      );
    }
    return <span>{new String(getField(suggestion,valueField))}</span>;
  };

  render() {
    const {
      value,
      isFetching,
      forID,
      queryHits,
      classNameWrapper,
      setActiveStyle,
      setInactiveStyle
    } = this.props;

    const inputProps = {
      placeholder: '',
      value: value || '',
      onChange: this.onChange,
      id: forID,
      className: classNameWrapper,
      onFocus: setActiveStyle,
      onBlur: setInactiveStyle,
    };

    const suggestions = (queryHits.get) ? queryHits.get(this.controlID, []) : [];

    return (
      <div>
        <Autosuggest
          suggestions={suggestions}
          onSuggestionsFetchRequested={this.onSuggestionsFetchRequested}
          onSuggestionsClearRequested={this.onSuggestionsClearRequested}
          onSuggestionSelected={this.onSuggestionSelected}
          getSuggestionValue={this.getSuggestionValue}
          renderSuggestion={this.renderSuggestion}
          inputProps={inputProps}
          focusInputOnSuggestionClick={false}
          />
        <Loader active={isFetching === this.controlID} />
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {
  const { className } = ownProps;
  const isFetching = state.search.get('isFetching');
  const queryHits = state.search.get('queryHits');
  return { isFetching, queryHits, className };
}

export default connect(
  mapStateToProps,
  {
    query,
    clearSearch,
  },
  null,
  {
    withRef: true,
  }
)(RelationControl);
