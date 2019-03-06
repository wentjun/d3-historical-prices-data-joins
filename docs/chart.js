class HistoricalPriceChart {
  constructor() {
    this.margin;
    this.width;
    this.height;
    this.xScale;
    this.yscale;
    this.zoom;
    this.currentData = [];
    this.dividendData = [];
    this.bollingerBandsData = undefined;
    this.movingAverageData = undefined;
    this.loadData('vig').then(data => {
      this.initialiseChart(data);
    });

    const selectElement = document.getElementById('select-stock');
    selectElement.addEventListener('change', event => {
      this.setDataset(event);
    });

    const viewClose = document.querySelector('input[id=close]');
    viewClose.addEventListener('change', event => {
      this.toggleClose(document.querySelector('input[id=close]').checked);
    });

    const viewMovingAverage = document.querySelector(
      'input[id=moving-average]'
    );
    viewMovingAverage.addEventListener('change', event => {
      this.toggleMovingAverage(
        document.querySelector('input[id=moving-average]').checked
      );
    });

    const viewOHLC = document.querySelector('input[id=ohlc]');
    viewOHLC.addEventListener('change', event => {
      this.toggleOHLC(document.querySelector('input[id=ohlc]').checked);
    });

    const viewCandlesticks = document.querySelector('input[id=candlesticks]');
    viewCandlesticks.addEventListener('change', event => {
      this.toggleCandlesticks(
        document.querySelector('input[id=candlesticks]').checked
      );
    });

    const viewBollingerBands = document.querySelector(
      'input[id=bollinger-bands]'
    );
    viewBollingerBands.addEventListener('change', event => {
      this.toggleBollingerBands(
        document.querySelector('input[id=bollinger-bands]').checked
      );
    });
  }

  loadData(selectedDataset = 'vig') {
    let loadFile = '';
    if (selectedDataset === 'vig') {
      loadFile = 'sample-data-vig.json';
    } else if (selectedDataset === 'vti') {
      loadFile = 'sample-data-vti.json';
    } else if (selectedDataset === 'vea') {
      loadFile = 'sample-data-vea.json';
    }

    return d3.json(loadFile).then(data => {
      const chartResultsData = data['chart']['result'][0];
      const quoteData = chartResultsData['indicators']['quote'][0];

      return {
        dividends: Object.values(chartResultsData['events']['dividends']).map(
          res => {
            return {
              date: new Date(res['date'] * 1000),
              yield: res['amount']
            };
          }
        ),
        quote: chartResultsData['timestamp'].map((time, index) => ({
          date: new Date(time * 1000),
          high: quoteData['high'][index],
          low: quoteData['low'][index],
          open: quoteData['open'][index],
          close: quoteData['close'][index],
          volume: quoteData['volume'][index]
        }))
      };
    });
  }

  calculateMovingAverage(data, numberOfPricePoints) {
    return data.map((row, index, total) => {
      const start = Math.max(0, index - numberOfPricePoints);
      //const end = index + numberOfPricePoints;
      const end = index;
      const subset = total.slice(start, end + 1);
      const sum = subset.reduce((a, b) => {
        return a + b['close'];
      }, 0);

      return {
        date: row['date'],
        average: sum / subset.length
      };
    });
  }

  calculateBollingerBands(data, numberOfPricePoints) {
    let sumSquaredDifference = 0;
    return data.map((row, index, total) => {
      const start = Math.max(0, index - numberOfPricePoints);
      const end = index;
      const subset = total.slice(start, end + 1);
      const sum = subset.reduce((a, b) => {
        return a + b['close'];
      }, 0);

      const sumSquaredDifference = subset.reduce((a, b) => {
        const average = sum / subset.length;
        const dfferenceFromMean = b['close'] - average;
        const squaredDifferenceFromMean = Math.pow(dfferenceFromMean, 2);
        return a + squaredDifferenceFromMean;
      }, 0);
      const variance = sumSquaredDifference / subset.length;

      return {
        date: row['date'],
        average: sum / subset.length,
        standardDeviation: Math.sqrt(variance),
        upperBand: sum / subset.length + Math.sqrt(variance) * 2,
        lowerBand: sum / subset.length - Math.sqrt(variance) * 2
      };
    });
  }

  initialiseChart(data) {
    const thisYearStartDate = new Date(2018, 4, 31);
    const nextYearStartDate = new Date(2019, 0, 1);
    // remove invalid data points
    const validData = data['quote'].filter(
      row => row['high'] && row['low'] && row['close'] && row['open']
    );
    // filter out data based on time period
    this.currentData = validData.filter(row => {
      if (row['date']) {
        return (
          row['date'] >= thisYearStartDate && row['date'] < nextYearStartDate
        );
      }
    });
    // calculates simple moving average over 50 days
    this.movingAverageData = this.calculateMovingAverage(validData, 49);
    // calculates simple moving average, and standard deviation over 20 days
    this.bollingerBandsData = this.calculateBollingerBands(validData, 19);

    const viewportWidth = Math.max(
      document.documentElement.clientWidth,
      window.innerWidth
    );
    const viewportHeight = Math.max(
      document.documentElement.clientHeight,
      window.innerHeight
    );
    this.margin = { top: 50, right: 50, bottom: 50, left: 20 };
    if (viewportWidth <= 768) {
      this.width = viewportWidth - this.margin.left - this.margin.right; // Use the window's width
      this.height = 0.5 * viewportHeight - this.margin.top - this.margin.bottom; // Use the window's height
    } else {
      this.width = 0.75 * viewportWidth - this.margin.left - this.margin.right;
      this.height = viewportHeight - this.margin.top - this.margin.bottom; // Use the window's height
    }

    // find data range
    const xMin = d3.min(this.currentData, d => d['date']);
    const xMax = d3.max(this.currentData, d => d['date']);
    const yMin = d3.min(this.currentData, d => d['close']);
    const yMax = d3.max(this.currentData, d => d['close']);

    // scale using range
    this.xScale = d3
      .scaleTime()
      .domain([xMin, xMax])
      .range([0, this.width]);

    this.yScale = d3
      .scaleLinear()
      .domain([yMin - 5, yMax + 4])
      .range([this.height, 0]);

    // add chart SVG to the page
    const svg = d3
      .select('#chart')
      .append('svg')
      .attr('width', this.width + this.margin['left'] + this.margin['right'])
      .attr('height', this.height + this.margin['top'] + this.margin['bottom'])
      .append('g')
      .attr(
        'transform',
        `translate(${this.margin['left']}, ${this.margin['top']})`
      );

    // create the axes component
    this.xAxis = svg
      .append('g')
      .attr('class', 'xAxis')
      .attr('transform', `translate(0, ${this.height})`)
      .call(d3.axisBottom(this.xScale));

    this.yAxis = svg
      .append('g')
      .attr('class', 'yAxis')
      .attr('transform', `translate(${this.width}, 0)`)
      .call(d3.axisRight(this.yScale));
    svg
      .append('g')
      .attr('id', 'leftAxis')
      .attr('transform', `translate(0, 0)`);

    // define x and y crosshair properties
    const focus = svg
      .append('g')
      .attr('class', 'focus')
      .style('display', 'none');

    focus.append('circle').attr('r', 4.5);
    focus.append('line').classed('x', true);
    focus.append('line').classed('y', true);

    svg
      .append('rect')
      .attr('class', 'overlay')
      .attr('width', this.width)
      .attr('height', this.height);

    d3.select('.overlay')
      .style('fill', 'none')
      .style('pointer-events', 'all');

    d3.selectAll('.focus line')
      .style('fill', 'none')
      .style('stroke', '#67809f')
      .style('stroke-width', '1.5px')
      .style('stroke-dasharray', '3 3');

    // get VIG dividend data for year of 2018
    this.dividendData = data['dividends'].filter(row => {
      if (row['date']) {
        return (
          row['date'] >= thisYearStartDate && row['date'] < nextYearStartDate
        );
      }
    });

    svg
      .append('clipPath')
      .attr('id', 'clip')
      .append('rect')
      .attr('width', this.width)
      .attr('height', this.height);

    // group volume series bar charts, and with clip-path attribute
    svg
      .append('g')
      .attr('id', 'volume-series')
      .attr('clip-path', 'url(#clip)');

    // group dividend symbols, and with clip-path attribute
    svg
      .append('g')
      .attr('id', 'dividends')
      .attr('clip-path', 'url(#clip)');

    // candlesticks, and with clip-path attribute
    svg
      .append('g')
      .attr('id', 'candlesticks-series')
      .attr('clip-path', 'url(#clip)');

    // ohlc, and with clip-path attribute
    svg
      .append('g')
      .attr('id', 'ohlc-series')
      .attr('clip-path', 'url(#clip)');

    // generates the rest of the graph
    this.updateChart();

    /* Handle zoom and pan */
    this.zoom = d3
      .zoom()
      .scaleExtent([1, 10])
      .translateExtent([[0, 0], [this.width, this.height]]) // pan limit
      .extent([[0, 0], [this.width, this.height]]) // zoom limit
      .on('zoom', (d, i, nodes) => this.zoomed(d, i, nodes));

    d3.select('svg').call(this.zoom);
  }

  zoomed(d, i, nodes) {
    const xAxis = d3.axisBottom(this.xScale);
    const yAxis = d3.axisRight(this.yScale);
    const ohlcLine = d3
      .line()
      .x(d => d['x'])
      .y(d => d['y']);
    const candlesticksLine = d3
      .line()
      .x(d => d['x'])
      .y(d => d['y']);
    const tickWidth = 5;
    const bodyWidth = 5;
    // only fire the zoomed function when an actual event is triggered, rather than on every update
    if (d3.event.sourceEvent || d3.event.transform.k !== 1) {
      // create new scale ojects based on zoom/pan event
      const updatedXScale = d3.event.transform.rescaleX(this.xScale);
      const updatedYScale = d3.event.transform.rescaleY(this.yScale);
      // update axes
      const xMin = d3.min(this.currentData, d => d['date']);
      const xMax = d3.max(this.currentData, d => d['date']);
      const xRescale = d3
        .scaleTime()
        .domain([xMin, xMax])
        .range([0, this.width]);
      this.xScale.domain(d3.event.transform.rescaleX(xRescale).domain());
      this.yAxis.call(yAxis.scale(updatedYScale));
      this.xAxis.call(xAxis.scale(updatedXScale));
      // update close price and moving average lines based on zoom/pan
      const updateClosePriceChartPlot = d3
        .line()
        .x(d => updatedXScale(d['date']))
        .y(d => updatedYScale(d['close']));
      const updateMovingAverageLinePlot = d3
        .line()
        .x(d => updatedXScale(d['date']))
        .y(d => updatedYScale(d['average']))
        .curve(d3.curveBasis);

      d3.select('.moving-average-line').attr('d', updateMovingAverageLinePlot);
      d3.select('.price-chart').attr('d', updateClosePriceChartPlot);

      // update dividends based on zoom/pan
      d3.selectAll('.dividend-group').attr(
        'transform',
        (d, i) => `translate(${updatedXScale(d['date'])},${this.height - 80})`
      );

      // update volume series based on zoom/pan
      d3.selectAll('.vol').attr('x', d => updatedXScale(d['date']));

      // update ohlc series based on zoom/pan
      d3.selectAll('.ohlc .high-low').attr('d', d => {
        return ohlcLine([
          { x: updatedXScale(d['date']), y: updatedYScale(d['high']) },
          { x: updatedXScale(d['date']), y: updatedYScale(d['low']) }
        ]);
      });
      d3.selectAll('.open-tick').attr('d', d => {
        return ohlcLine([
          {
            x: updatedXScale(d['date']) - tickWidth,
            y: updatedYScale(d['open'])
          },
          { x: updatedXScale(d['date']), y: updatedYScale(d['open']) }
        ]);
      });
      d3.selectAll('.close-tick').attr('d', d => {
        return ohlcLine([
          { x: updatedXScale(d['date']), y: updatedYScale(d['close']) },
          {
            x: updatedXScale(d['date']) + tickWidth,
            y: updatedYScale(d['close'])
          }
        ]);
      });

      // update candlesticks series based on zoom/pan
      d3.selectAll('.candlestick .high-low').attr('d', d => {
        return candlesticksLine([
          { x: updatedXScale(d['date']), y: updatedYScale(d['high']) },
          { x: updatedXScale(d['date']), y: updatedYScale(d['low']) }
        ]);
      });
      d3.selectAll('.candlestick rect')
        .attr('x', d => updatedXScale(d['date']) - bodyWidth / 2)
        .attr('y', d => {
          return d['close'] > d['open']
            ? updatedYScale(d['close'])
            : updatedYScale(d['open']);
        })
        .attr('height', d => {
          return d['close'] > d['open']
            ? updatedYScale(d['open']) - updatedYScale(d['close'])
            : updatedYScale(d['close']) - updatedYScale(d['open']);
        });

      // update bollinger Bands based on zoom/pan
      const updateUpperBandPlot = d3
        .line()
        .x(d => updatedXScale(d['date']))
        .y(d => updatedYScale(d['upperBand']));
      const updateLowerBandPlot = d3
        .line()
        .x(d => updatedXScale(d['date']))
        .y(d => updatedYScale(d['lowerBand']))
        .curve(d3.curveBasis);
      const area = d3
        .area()
        .x(d => updatedXScale(d['date']))
        .y0(d => updatedYScale(d['upperBand']))
        .y1(d => updatedYScale(d['lowerBand']));
      d3.select('.upper-band').attr('d', updateUpperBandPlot);
      d3.select('.lower-band').attr('d', updateLowerBandPlot);
      d3.select('.middle-band').attr('d', updateMovingAverageLinePlot);
      d3.select('.band-area').attr('d', area);

      // update crosshair position on zooming/panning
      const overlay = d3.select('.overlay');
      const focus = d3.select('.focus');
      const bisectDate = d3.bisector(d => d.date).left;

      // remove old crosshair
      overlay.exit().remove();

      // enter, and update the attributes
      overlay
        .enter()
        .append('g')
        .attr('class', 'focus')
        .style('display', 'none');

      overlay
        .attr('class', 'overlay')
        .attr('width', this.width)
        .attr('height', this.height)
        .on('mouseover', () => focus.style('display', null))
        .on('mouseout', () => focus.style('display', 'none'))
        .on('mousemove', (d, i, nodes) => {
          const correspondingDate = updatedXScale.invert(d3.mouse(nodes[i])[0]);
          //gets insertion point
          const i1 = bisectDate(this.currentData, correspondingDate, 1);
          const d0 = this.currentData[i1 - 1];
          const d1 = this.currentData[i1];
          const currentPoint =
            correspondingDate - d0['date'] > d1['date'] - correspondingDate
              ? d1
              : d0;
          focus.attr(
            'transform',
            `translate(${updatedXScale(currentPoint['date'])}, ${updatedYScale(
              currentPoint['close']
            )})`
          );

          focus
            .select('line.x')
            .attr('x1', 0)
            .attr('x2', this.width - updatedXScale(currentPoint['date']))
            .attr('y1', 0)
            .attr('y2', 0);

          focus
            .select('line.y')
            .attr('x1', 0)
            .attr('x2', 0)
            .attr('y1', 0)
            .attr('y2', this.height - updatedYScale(currentPoint['close']));

          this.updateLegends(currentPoint);
          this.updateSecondaryLegends(currentPoint['date']);
        });
    }
  }

  setDataset(event) {
    this.loadData(event.target.value).then(response => {
      const thisYearStartDate = new Date(2018, 4, 31);
      const nextYearStartDate = new Date(2019, 0, 1);
      // remove invalid data points
      const validData = response['quote'].filter(
        row => row['high'] && row['low'] && row['close'] && row['open']
      );

      this.currentData = validData.filter(row => {
        if (row['date']) {
          return (
            row['date'] >= thisYearStartDate && row['date'] < nextYearStartDate
          );
        }
      });

      this.movingAverageData = this.calculateMovingAverage(validData, 49);

      this.bollingerBandsData = this.calculateBollingerBands(validData, 19);

      const viewportWidth = Math.max(
        document.documentElement.clientWidth,
        window.innerWidth
      );
      const viewportHeight = Math.max(
        document.documentElement.clientHeight,
        window.innerHeight
      );
      if (viewportWidth <= 768) {
        this.width = viewportWidth - this.margin.left - this.margin.right; // Use the window's width
        this.height =
          0.5 * viewportHeight - this.margin.top - this.margin.bottom; // Use the window's height
      } else {
        this.width =
          0.75 * viewportWidth - this.margin.left - this.margin.right;
        this.height = viewportHeight - this.margin.top - this.margin.bottom; // Use the window's height
      }

      /* update the min, max values, and scales for the axes */
      const xMin = d3.min(this.currentData, d => Math.min(d['date']));
      const xMax = d3.max(this.currentData, d => Math.max(d['date']));
      const yMin = d3.min(this.currentData, d => Math.min(d['close']));
      const yMax = d3.max(this.currentData, d => Math.max(d['close']));

      this.xScale.domain([xMin, xMax]);
      this.yScale.domain([yMin - 5, yMax + 4]);

      // get dividend data for current dataset
      this.dividendData = response['dividends'].filter(row => {
        if (row['date']) {
          return (
            row['date'] >= thisYearStartDate && row['date'] < nextYearStartDate
          );
        }
      });

      this.updateChart();
    });
  }

  updateChart() {
    /* Update the axes */
    d3.select('.xAxis').call(d3.axisBottom(this.xScale));
    d3.select('.yAxis').call(d3.axisRight(this.yScale));

    /* updating of crosshair */
    this.updateCrosshairProperties();

    /* Update the volume series bar chart */
    this.renderVolumeBarCharts();

    /* Update dividend indicators */
    this.renderDividendIndicators();

    /* Update the price chart */
    const closeCheckboxToggle = document.querySelector('input[id=close]')
      .checked;
    this.toggleClose(closeCheckboxToggle);

    /* Update the moving average line */
    const movingAverageCheckboxToggle = document.querySelector(
      'input[id=moving-average]'
    ).checked;
    this.toggleMovingAverage(movingAverageCheckboxToggle);

    /* Display OHLC chart */
    const checkboxToggle = document.querySelector('input[id=ohlc]').checked;
    this.toggleOHLC(checkboxToggle);

    /* Display Candlesticks chart */
    const candlesticksToggle = document.querySelector('input[id=candlesticks]')
      .checked;
    this.toggleCandlesticks(candlesticksToggle);

    /* Display Bollinger Bands */
    const toggleBollingerBands = document.querySelector(
      'input[id=bollinger-bands]'
    ).checked;
    this.toggleBollingerBands(toggleBollingerBands);
  }

  /* Mouseover function to generate crosshair */
  generateCrosshair(current) {
    //returns corresponding value from the domain
    const focus = d3.select('.focus');
    const bisectDate = d3.bisector(d => d.date).left;
    const correspondingDate = this.xScale.invert(d3.mouse(current)[0]);
    //gets insertion point
    const i = bisectDate(this.currentData, correspondingDate, 1);
    const d0 = this.currentData[i - 1];
    const d1 = this.currentData[i];
    const currentPoint =
      correspondingDate - d0['date'] > d1['date'] - correspondingDate ? d1 : d0;
    focus.attr(
      'transform',
      `translate(${this.xScale(currentPoint['date'])}, ${this.yScale(
        currentPoint['close']
      )})`
    );

    focus
      .select('line.x')
      .attr('x1', 0)
      .attr('x2', this.width - this.xScale(currentPoint['date']))
      .attr('y1', 0)
      .attr('y2', 0);

    focus
      .select('line.y')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', 0)
      .attr('y2', this.height - this.yScale(currentPoint['close']));

    // updates the legend to display the date, open, close, high, low, and volume and selected mouseover area
    this.updateLegends(currentPoint);
    // secondary legends showing moving average and bollinger bands values
    this.updateSecondaryLegends(currentPoint['date']);
  }

  updateLegends(currentPoint) {
    d3.selectAll('.primary-legend').remove();
    const legendKeys = Object.keys(currentPoint);
    const lineLegendSelect = d3
      .select('#chart')
      .select('g')
      .selectAll('.primary-legend')
      .data(legendKeys);
    lineLegendSelect.join(
      enter =>
        enter
          .append('g')
          .attr('class', 'primary-legend')
          .attr('transform', (d, i) => `translate(0, ${i * 20})`)
          .append('text')
          .text(d => {
            if (d === 'date') {
              return `${d}: ${currentPoint[d].toLocaleDateString()}`;
            } else if (
              d === 'high' ||
              d === 'low' ||
              d === 'open' ||
              d === 'close'
            ) {
              return `${d}: ${currentPoint[d].toFixed(2)}`;
            } else {
              return `${d}: ${currentPoint[d]}`;
            }
          })
          .style('font-size', '0.8em')
          .style('fill', 'white')
          .attr('transform', 'translate(15,9)') //align texts with boxes*/
    );
  }

  updateSecondaryLegends(currentDate) {
    const secondaryLegend = {};

    if (this.movingAverageData) {
      const currentPoint = this.movingAverageData.filter(
        dataPoint => dataPoint['date'] === currentDate
      )[0];
      secondaryLegend['movingAverage'] = currentPoint;
    }
    if (this.bollingerBandsData) {
      const currentBollingerBandsPoint = this.bollingerBandsData.filter(
        dataPoint => dataPoint['date'] === currentDate
      )[0];
      secondaryLegend['bollingerBands'] = currentBollingerBandsPoint;
    }
    const secondaryLegendKeys = Object.keys(secondaryLegend);

    d3.selectAll('.secondary-legend').remove();
    if (secondaryLegendKeys.length > 0) {
      const secondaryLegendSelect = d3
        .select('#chart')
        .select('g')
        .selectAll('.secondary-legend')
        .data(secondaryLegendKeys);
      secondaryLegendSelect.join(
        enter =>
          enter
            .append('g')
            .attr('class', 'secondary-legend')
            .attr('transform', (d, i) => `translate(0, ${i * 20})`)
            .append('text')
            .text(d => {
              if (d === 'movingAverage') {
                return `Moving Average (50): ${secondaryLegend[d][
                  'average'
                ].toFixed(2)}`;
              } else if (d === 'bollingerBands') {
                return `Bollinger Bands (20, 2.0, MA): ${secondaryLegend[d][
                  'lowerBand'
                ].toFixed(2)} - ${secondaryLegend[d]['average'].toFixed(
                  2
                )} - ${secondaryLegend[d]['upperBand'].toFixed(2)}`;
              }
            })
            .style('font-size', '0.8em')
            .style('fill', 'white')
            .attr('transform', 'translate(150,9)'),

        exit => exit.remove()
      );
    }
  }

  updateCrosshairProperties() {
    // select the existing crosshair, and bind new data
    const overlay = d3.select('.overlay');
    const focus = d3.select('.focus');

    // remove old crosshair
    overlay.exit().remove();

    // enter, and update the attributes
    overlay
      .enter()
      .append('g')
      .attr('class', 'focus')
      .style('display', 'none');

    overlay
      .attr('class', 'overlay')
      .attr('width', this.width)
      .attr('height', this.height)
      .on('mouseover', () => focus.style('display', null))
      .on('mouseout', () => focus.style('display', 'none'))
      .on('mousemove', (d, i, nodes) => this.generateCrosshair(nodes[i]));
  }

  renderVolumeBarCharts() {
    const chart = d3.select('#chart').select('g');
    const yMinVolume = d3.min(this.currentData, d => Math.min(d['volume']));
    const yMaxVolume = d3.max(this.currentData, d => Math.max(d['volume']));

    const yVolumeScale = d3
      .scaleLinear()
      .domain([yMinVolume, yMaxVolume])
      .range([this.height, this.height * (3 / 4)]);
    //d3.select('#leftAxis').call(d3.axisLeft(yVolumeScale));

    //select, followed by join
    const bars = d3
      .select('#volume-series')
      .selectAll('.vol')
      .data(this.currentData, d => d['date']);

    bars.join(
      enter =>
        enter
          .append('rect')
          .attr('class', 'vol')
          .attr('x', d => this.xScale(d['date']))
          .attr('y', d => yVolumeScale(d['volume']))
          .attr('fill', (d, i) => {
            if (i === 0) {
              return '#03a678';
            } else {
              // green bar if price is rising during that period, and red when price is falling
              return this.currentData[i - 1].close > d.close
                ? '#c0392b'
                : '#03a678';
            }
          })
          .attr('width', 1)
          .attr('height', d => this.height - yVolumeScale(d['volume'])),
      update =>
        update
          .transition()
          .duration(750)
          .attr('x', d => this.xScale(d['date']))
          .attr('y', d => yVolumeScale(d['volume']))
          .attr('fill', (d, i) => {
            if (i === 0) {
              return '#03a678';
            } else {
              // green bar if price is rising during that period, and red when price is falling
              return this.currentData[i - 1].close > d.close
                ? '#c0392b'
                : '#03a678';
            }
          })
          .attr('width', 1)
          .attr('height', d => this.height - yVolumeScale(d['volume']))
    );
  }

  renderDividendIndicators() {
    /* Updating of dividends */

    // select all dividend groups, and bind the new data
    const dividendSelect = d3
      .select('#dividends')
      .selectAll('.dividend-group')
      .data(this.dividendData);

    const dividendTooltip = d3
      .select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0);

    dividendSelect.join(
      enter => {
        // first, enter and append the group element, with the mousemove and mouseout events
        const enterSelection = enter
          .append('g')
          .attr('class', 'dividend-group')
          .on('mousemove', d => {
            dividendTooltip
              .style('opacity', 1)
              .style('color', '#464e56')
              .style('left', d3.event.pageX - 80 + 'px')
              .style('top', d3.event.pageY - 50 + 'px')
              .html(
                `<strong>Dividends: ${d['yield']}</strong> <br/> Date: ${d[
                  'date'
                ].toLocaleDateString()}`
              );
          })
          .on('mouseout', d => {
            dividendTooltip
              .transition()
              .duration(200)
              .style('opacity', 0);
          });
        // enter and append the square symbols representing the dividends to the group element
        enterSelection
          .append('path')
          .attr('class', 'dividend')
          .attr(
            'd',
            d3
              .symbol()
              .size(300)
              .type(d3.symbolSquare)
          )
          .style('opacity', 0.8)
          .style('cursor', 'pointer')
          .style('fill', '#00ced1');
        // enter and append the 'D' text to the group element
        enterSelection
          .append('text')
          .attr('x', -6)
          .attr('y', 5)
          .text(d => 'D')
          .style('cursor', 'pointer')
          .style('pointer-events', 'none') //allow mouseover to propagate
          .style('fill', '#464e56');
        // translate the elements to their respective positions
        enterSelection.attr(
          'transform',
          (d, i) => `translate(${this.xScale(d['date'])},${this.height - 80})`
        );
      },
      update =>
        update
          .transition()
          .duration(200)
          .attr(
            'transform',
            (d, i) => `translate(${this.xScale(d['date'])},${this.height - 80})`
          )
    );
  }

  toggleClose(value) {
    if (value) {
      if (this.zoom) {
        d3.select('svg')
          .transition()
          .duration(750)
          .call(this.zoom.transform, d3.zoomIdentity.scale(1));
      }

      const line = d3
        .line()
        .x(d => this.xScale(d['date']))
        .y(d => this.yScale(d['close']));
      const lineSelect = d3
        .select('#chart')
        .select('svg')
        .select('g')
        .selectAll('.price-chart')
        .data([this.currentData]);

      lineSelect.join(
        enter =>
          enter
            .append('path')
            .style('fill', 'none')
            .attr('class', 'price-chart')
            .attr('clip-path', 'url(#clip)')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', '1.5')
            .attr('d', line),
        update =>
          update
            .transition()
            .duration(750)
            .attr('d', line)
      );
    } else {
      // Remove close price chart
      d3.select('.price-chart').remove();
    }
  }

  toggleMovingAverage(value) {
    if (value) {
      if (this.zoom) {
        d3.select('svg')
          .transition()
          .duration(750)
          .call(this.zoom.transform, d3.zoomIdentity.scale(1));
      }

      const movingAverageLine = d3
        .line()
        .x(d => this.xScale(d['date']))
        .y(d => this.yScale(d['average']))
        .curve(d3.curveBasis);
      const movingAverageSelect = d3
        .select('#chart')
        .select('svg')
        .select('g')
        .selectAll('.moving-average-line')
        .data([this.movingAverageData]);

      movingAverageSelect.join(
        enter =>
          enter
            .append('path')
            .style('fill', 'none')
            .attr('class', 'moving-average-line')
            .attr('clip-path', 'url(#clip)')
            .attr('stroke', '#FF8900')
            .attr('stroke-width', '1.5')
            .attr('d', movingAverageLine),
        update =>
          update
            .transition()
            .duration(750)
            .attr('d', movingAverageLine)
      );
    } else {
      // Remove moving average line
      d3.select('.moving-average-line').remove();
    }
  }

  toggleOHLC(value) {
    if (value) {
      d3.select('svg')
        .transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity.scale(1));

      const tickWidth = 5;
      const ohlcLine = d3
        .line()
        .x(d => d['x'])
        .y(d => d['y']);

      const ohlcSelection = d3
        .select('#ohlc-series')
        .selectAll('.ohlc')
        .data(this.currentData, d => d['volume']);

      ohlcSelection.join(enter => {
        const ohlcEnter = enter
          .append('g')
          .attr('class', 'ohlc')
          .append('g')
          .attr('class', 'bars')
          .classed('up-day', d => d['close'] > d['open'])
          .classed('down-day', d => d['close'] <= d['open']);
        ohlcEnter
          .append('path')
          .classed('high-low', true)
          .attr('d', d => {
            return ohlcLine([
              { x: this.xScale(d['date']), y: this.yScale(d['high']) },
              { x: this.xScale(d['date']), y: this.yScale(d['low']) }
            ]);
          });
        ohlcEnter
          .append('path')
          .classed('open-tick', true)
          .attr('d', d => {
            return ohlcLine([
              {
                x: this.xScale(d['date']) - tickWidth,
                y: this.yScale(d['open'])
              },
              { x: this.xScale(d['date']), y: this.yScale(d['open']) }
            ]);
          });
        ohlcEnter
          .append('path')
          .classed('close-tick', true)
          .attr('d', d => {
            return ohlcLine([
              { x: this.xScale(d['date']), y: this.yScale(d['close']) },
              {
                x: this.xScale(d['date']) + tickWidth,
                y: this.yScale(d['close'])
              }
            ]);
          });
      });
    } else {
      // remove OHLC
      d3.select('#chart')
        .select('g')
        .selectAll('.ohlc')
        .remove();
    }
  }

  toggleCandlesticks(value) {
    if (value) {
      d3.select('svg')
        .transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity.scale(1));

      const bodyWidth = 5;
      const candlesticksLine = d3
        .line()
        .x(d => d['x'])
        .y(d => d['y']);

      const candlesticksSelection = d3
        .select('#candlesticks-series')
        .selectAll('.candlestick')
        .data(this.currentData, d => d['volume']);

      candlesticksSelection.join(enter => {
        const candlesticksEnter = enter
          .append('g')
          .attr('class', 'candlestick')
          .append('g')
          .attr('class', 'bars')
          .classed('up-day', d => d['close'] > d['open'])
          .classed('down-day', d => d['close'] <= d['open']);
        candlesticksEnter
          .append('path')
          .classed('high-low', true)
          .attr('d', d => {
            return candlesticksLine([
              { x: this.xScale(d['date']), y: this.yScale(d['high']) },
              { x: this.xScale(d['date']), y: this.yScale(d['low']) }
            ]);
          });
        candlesticksEnter
          .append('rect')
          .attr('x', d => this.xScale(d.date) - bodyWidth / 2)
          .attr('y', d => {
            return d['close'] > d['open']
              ? this.yScale(d.close)
              : this.yScale(d.open);
          })
          .attr('width', bodyWidth)
          .attr('height', d => {
            return d['close'] > d['open']
              ? this.yScale(d.open) - this.yScale(d.close)
              : this.yScale(d.close) - this.yScale(d.open);
          });
      });
    } else {
      // remove candlesticks
      d3.select('#chart')
        .select('g')
        .selectAll('.candlestick')
        .remove();
    }
  }

  toggleBollingerBands(value) {
    if (value) {
      d3.select('svg')
        .transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity.scale(1));

      const movingAverage = d3
        .line()
        .x(d => this.xScale(d['date']))
        .y(d => this.yScale(d['average']))
        .curve(d3.curveBasis);
      const upperBand = d3
        .line()
        .x(d => this.xScale(d['date']))
        .y(d => this.yScale(d['upperBand']))
        .curve(d3.curveBasis);
      const lowerBand = d3
        .line()
        .x(d => this.xScale(d['date']))
        .y(d => this.yScale(d['lowerBand']))
        .curve(d3.curveBasis);

      // middle band - moving average
      const movingAverageSelect = d3
        .select('#chart')
        .select('svg')
        .select('g')
        .selectAll('.middle-band')
        .data([this.bollingerBandsData]);

      movingAverageSelect.join(
        enter =>
          enter
            .append('path')
            .style('fill', 'none')
            .attr('class', 'middle-band')
            .attr('clip-path', 'url(#clip)')
            .attr('stroke', 'darkgrey')
            .attr('stroke-width', '1.5')
            .attr('d', movingAverage),
        update =>
          update
            .transition()
            .duration(750)
            .attr('d', movingAverage)
      );

      // upper band
      const upperBandSelect = d3
        .select('#chart')
        .select('svg')
        .select('g')
        .selectAll('.upper-band')
        .data([this.bollingerBandsData]);

      upperBandSelect.join(
        enter =>
          enter
            .append('path')
            .style('fill', 'none')
            .attr('class', 'upper-band')
            .attr('clip-path', 'url(#clip)')
            .attr('stroke', 'darkgrey')
            .attr('stroke-width', '1')
            .attr('d', upperBand),
        update =>
          update
            .transition()
            .duration(750)
            .attr('d', upperBand)
      );

      // lower band
      const lowerBandSelect = d3
        .select('#chart')
        .select('svg')
        .select('g')
        .selectAll('.lower-band')
        .data([this.bollingerBandsData]);

      lowerBandSelect.join(
        enter =>
          enter
            .append('path')
            .style('fill', 'none')
            .attr('class', 'lower-band')
            .attr('clip-path', 'url(#clip)')
            .attr('stroke', 'darkgrey')
            .attr('stroke-width', '1')
            .attr('d', lowerBand),
        update =>
          update
            .transition()
            .duration(750)
            .attr('d', lowerBand)
      );

      const area = d3
        .area()
        .x(d => this.xScale(d['date']))
        .y0(d => this.yScale(d['upperBand']))
        .y1(d => this.yScale(d['lowerBand']));

      const areaSelect = d3
        .select('#chart')
        .select('svg')
        .select('g')
        .selectAll('.band-area')
        .data([this.bollingerBandsData]);

      areaSelect.join(
        enter =>
          enter
            .append('path')
            .style('fill', 'darkgrey')
            .style('opacity', 0.2)
            .style('pointer-events', 'none') //allow mouseover to propagate
            .attr('class', 'band-area')
            .attr('clip-path', 'url(#clip)')
            .attr('d', area),
        update =>
          update
            .transition()
            .duration(750)
            .attr('d', area)
      );
    } else {
      // remove bollinger bands
      d3.select('#chart')
        .select('g')
        .selectAll('.middle-band, .lower-band, .upper-band, .band-area')
        .remove();
    }
  }
}
