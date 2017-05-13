import React, { Component } from 'react';
import { first } from 'lodash/fp';
import { DropTarget } from 'react-dnd';
import { NativeTypes } from 'react-dnd-html5-backend';
import ReactPlayer from 'react-player';
import ReactPDF from 'react-pdf';
import RgbQuant from 'rgbquant';
import { LeftArrow, RightArrow } from './Arrows';
import './button.css';

const { FILE } = NativeTypes;
const electronRequire = name => window.require('electron').remote.require(name);

class FolderDrop extends Component {
  constructor(props) {
    super(props);
    this.state = {
      packageJson: {},
      slideIndex: 0,
      playing: true,
      windowHeight: window.innerHeight,
      windowWidth: window.innerWidth,
      backgroundColor: 'black'
    };
  }

  onResize() {
    this.setState({
      windowHeight: window.innerHeight,
      windowWidth: window.innerWidth
    });
  }

  componentDidMount() {
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keyup', ({ key }) => this.onKeyPress(key));
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
  }

  navigateSlideBy(slideIncrement) {
    const { videoDuration, packageJson, slideIndex, totalSlides } = this.state;
    const newSlideIndex = slideIndex + slideIncrement;
    const seekTime = packageJson.times[newSlideIndex];
    const seekPercentage = seekTime / videoDuration;
    if (newSlideIndex > 0 && newSlideIndex < totalSlides) {
      this.refs.player.seekTo(seekPercentage + 0.0001);
      this.setState({ slideIndex: newSlideIndex });
    } else if (newSlideIndex === 0 && slideIncrement === -1) {
      this.refs.player.seekTo(0);
    }
  }

  scaledWidth() {
    const { windowWidth, windowHeight, slideWidth, slideHeight } = this.state;
    const idealWidth = windowHeight * (slideWidth / slideHeight);
    return windowWidth < idealWidth ? windowWidth : idealWidth;
  }

  computeBackground() {
    const canvas = this.refs.pdf.getElementsByTagName('canvas')[0];
    const quantize = new RgbQuant({ colors: 1 });
    quantize.sample(canvas);
    const palette = quantize.palette();
    const [red, green, blue] = palette;
    const toHex = decimal => ('0' + Number(decimal).toString(16)).slice(-2);
    const averageColorHex = `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
    this.setState({ backgroundColor: averageColorHex });
  }

  onKeyPress(key) {
    switch (key) {
      case 'ArrowLeft':
        this.navigateSlideBy(-1);
        break;
      case 'ArrowRight':
        this.navigateSlideBy(+1);
        break;
      case ' ':
        this.setState(({ playing }) => ({ playing: !playing }));
        break;
      default:
        break;
    }
  }

  render() {
    const { canDrop, isOver, dropTarget } = this.props;
    return dropTarget()(
      <div
        className="folder-drop"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          color: 'white',
          backgroundColor: (canDrop && isOver && 'gray') ||
            this.state.backgroundColor
        }}
      >
        {!this.state.slidesSrc && <h1>Drop Your Slide Folder Here</h1>}
        {this.state.slidesSrc &&
          !isOver &&
          <div ref="pdf">
            <ReactPDF
              width={this.scaledWidth()}
              height={this.state.windowHeight}
              file={this.state.slidesSrc}
              onDocumentLoad={({ total: totalSlides }) =>
                this.setState({ totalSlides })}
              pageIndex={this.state.slideIndex}
              onPageLoad={({
                originalWidth: slideWidth,
                originalHeight: slideHeight
              }) => this.setState({ slideWidth, slideHeight })}
              onPageRender={() => this.computeBackground()}
            />
            {this.state.slideIndex > 0 &&
              <button
                className="vertical-side-button"
                style={{
                  left: 0,
                  borderRadius: '0em 2em 2em 0em'
                }}
                onClick={() => this.navigateSlideBy(-1)}
              >
                <LeftArrow />
              </button>}
            {this.state.slideIndex + 1 < this.state.totalSlides &&
              <button
                className="vertical-side-button"
                style={{
                  right: 0,
                  borderRadius: '2em 0em 0em 2em'
                }}
                onClick={() => this.navigateSlideBy(+1)}
              >
                <RightArrow />
              </button>}
          </div>}

        <ReactPlayer
          style={{
            position: 'fixed',
            right: 0,
            bottom: 0
          }}
          width={320}
          height={240}
          ref="player"
          url={this.state.videoSrc}
          playing={this.state.playing}
          onDuration={videoDuration => this.setState({ videoDuration })}
          onProgress={({ played = 0 }) => {
            const { videoDuration, packageJson: { times = [] } } = this.state;
            const secondsElapsed = played * videoDuration;
            const slideIndex =
              times.findIndex(time => time >= secondsElapsed) - 1;
            this.setState({ slideIndex: slideIndex < 0 ? 0 : slideIndex });
          }}
          controls
        />

      </div>
    );
  }
}

const dropSpec = {
  drop(props, monitor, component) {
    const fs = electronRequire('fs');
    const path = electronRequire('path');
    Array.from(monitor.getItem().files)
      .filter(({ path }) => fs.lstatSync(path).isDirectory())
      .forEach(({ path: directory }) => {
        fs.readdir(directory, (err, files) => {
          const fileWithExtension = ext =>
            first(files.filter(file => path.extname(file) === ext));
          const video = fileWithExtension('.mp4');
          const slides = fileWithExtension('.pdf');
          const packagePath = fileWithExtension('.json');
          if (video && slides && packagePath) {
            const pathInDirectory = file => path.join(directory, file);
            const fileInDirectory = file => `file://${pathInDirectory(file)}`;
            const packageJson = JSON.parse(
              fs.readFileSync(pathInDirectory(packagePath), 'utf8')
            );
            component.setState({
              slideIndex: 0,
              videoSrc: fileInDirectory(video),
              slidesSrc: fileInDirectory(slides),
              packageJson
            });
            document.title = path.basename(directory);
          }
        });
      });
  }
};

export default DropTarget(FILE, dropSpec, (connect, monitor) => ({
  ...connect,
  isOver: monitor.isOver(),
  canDrop: monitor.canDrop()
}))(FolderDrop);
