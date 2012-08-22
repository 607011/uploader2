#!/bin/sh
echo
echo MAKING DIRECTORIES ..
mkdir -p deploy/js
mkdir -p deploy/css
mkdir -p deploy/img

PATHTOYUI=`pwd`/bin
echo COMPRESSING JAVASCRIPTS ..
cd js/src
for f in *.js
do
  java -jar ${PATHTOYUI}/yuicompressor-2.4.2.jar -v --type js --charset utf-8 -o ../../deploy/js/$f $f
done

cd ../..

echo COMPRESSING STYLESHEETS ..
cd css/src
for f in *.css
do
  java -jar ${PATHTOYUI}/yuicompressor-2.4.2.jar -v --type css --charset utf-8 -o ../../deploy/css/$f $f
done

cd ../..

echo COPYING/CONVERTING FILES ..
cp img/* deploy/img
sed -e "s/js\/src/js/" -e "s/css\/src/css/" index.html > deploy/index.html

echo READY.
