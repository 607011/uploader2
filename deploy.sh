#!/bin/sh
echo
echo ==============================================
echo DEPLOYING
echo ==============================================
mkdir -p deploy/js
mkdir -p deploy/css
mkdir -p deploy/img

cp img/* deploy/img

PATHTOYUI=`pwd`/bin
echo ==============================================
echo COMPRESSING JAVASCRIPTS
echo ==============================================
cd js/src
for f in *.js
do
  java -jar ${PATHTOYUI}/yuicompressor-2.4.2.jar -v --type js --charset utf-8 -o ../../deploy/js/$f $f
done
cd ../..
echo ==============================================
echo COMPRESSING STYLESHEETS
echo ==============================================
cd css/src
for f in *.css
do
  java -jar ${PATHTOYUI}/yuicompressor-2.4.2.jar -v --type css --charset utf-8 -o ../../deploy/css/$f $f
done
cd ../..
sed -e "s/js\/src/js/" -e "s/css\/src/css/" index.html > deploy/index.html


echo READY.
