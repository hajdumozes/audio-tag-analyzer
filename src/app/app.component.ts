import {Component, NgZone, OnInit} from '@angular/core';
import * as mm from 'music-metadata-browser';

import fileReaderStream from 'filereader-stream';
import http from 'stream-http';
import * as createDebug from 'debug';

import {commonLabels, formatLabels, TagLabel} from './format-tags';

const debug = createDebug('audio-tag-analyzer');

interface IValue {
  text: string;
  ref?: string;
}

interface ITagText {
  key: string;
  label: IValue;
  value: IValue[];
}

interface IUrlAsFile {
  name: string;
  type: string;
}

interface IFileAnalysis {
  file: File | IUrlAsFile;
  http?: {
    url: string;
    type: string;
  };
  metadata?: mm.IAudioMetadata;
  parseError?: Error;
}

interface ITagList {
  title: string;
  key: string;
  tags?: ITagText[];
}

const logos = [
  'https://upload.wikimedia.org/wikipedia/commons/e/e0/Flac_logo_vector.svg',
  'https://upload.wikimedia.org/wikipedia/commons/e/ea/Mp3.svg',
  'https://upload.wikimedia.org/wikipedia/commons/0/02/Opus_logo2.svg',
  'https://upload.wikimedia.org/wikipedia/en/a/ac/XiphophorusLogoSVG.svg',
  'https://www.shareicon.net/download/2015/12/08/684232_file.svg',
  'http://www.wavpack.com/wavpacklogo.svg'
];

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  public results: IFileAnalysis[];

  public tagLists: ITagList[] = [{
    title: 'Format',
    key: 'format'
  }, {
    title: 'Generic tags',
    key: 'common'
  }];

  public logos = logos;

  public nativeTags: {type: string, tags: {id: string, value: string}[]}[] = [];

  public version = {
    app: require('../../package.json').version,
    mmb: require('../../node_modules/music-metadata-browser/package.json').version,
    mm: require('../../node_modules/music-metadata/package.json').version
  };

  constructor(private zone: NgZone) {
  }


  public handleFilesDropped(files: File[]) {
    this.results = []; // initialize results
    this.parseFiles(files);
    debug('handleFilesDropped', {files});
  }

  public handleTextDropped(text) {
    this.results = []; // initialize results
    if (text.indexOf('http') === 0) {
      return this.parseUsingHttp(text);
    } else {
    }
  }

  public handleFilesEnter(event) {
    debug('handleFilesEnter', event);
  }

  public handleFilesLeave(event) {
    console.log('handleFilesLeave', event);
  }

  private prepareTags(labels: TagLabel[], tags): ITagText[] {
    return labels.filter(label => tags.hasOwnProperty(label.key)).map(label => {
        const av = Array.isArray(tags[label.key]) ? tags[label.key] : [tags[label.key]];
        return {
          key: label.key,
          label: {text: label.label, ref: label.keyRef},
          value: av.map(v => {
            return {
              text: label.toText ? label.toText(v) : v,
              ref: label.valueRef ? label.valueRef(v) : undefined
            };
          })
        };
      }
    );
  }

  private prepareNativeTags(tags): {type: string, tags: {id: string, value: string}[]}[] {
    return Object.keys(tags).map(type => {
      return {
        type,
        tags: tags[type]
      };
    });
  }

  private parseUsingHttp(url: string): Promise<void> {
    debug('Converting HTTP to stream using: ' + url);
    return this.httpGetByUrl(url).then(stream => {
      // ToDo return this.parseStream({name: url, type: stream.headers['content-type']}, stream);
    });
  }

  private httpGetByUrl(url: string): Promise<any> {
    // Assume URL
    return new Promise(resolve => {
      http.get(url, stream => {
        resolve(stream);
      });
    });
  }

  private parseFiles(files: File[]): Promise<void> {
    const file: File = files.shift();
    if (file) {
      debug('Start parsing file %s', file.name);
      const stream = fileReaderStream(file);
      return this.parseStream(file, stream).then(() => {
        return this.parseFiles(files);
      });
    }
  }

  private parseStream(file: File, stream): Promise<void> {
    debug('Parsing %s of type %s', file.name, file.type);
    const result: IFileAnalysis = {
      file
    };
    this.results.push(result);
    return mm.parseFile(file, {native: true}).then(metadata => {
      this.zone.run(() => {
        debug('Completed parsing of %s:', file.name, metadata);
        result.metadata = metadata;
        this.tagLists[0].tags = this.prepareTags(formatLabels, metadata.format);
        this.tagLists[1].tags = this.prepareTags(commonLabels, metadata.common);
        this.nativeTags = this.prepareNativeTags(metadata.native);
      });
    }).catch(err => {
      this.zone.run<void>(() => {
        debug('Error: ' + err.message);
        result.parseError = err.message;
      });
    }) as any;
  }

}
